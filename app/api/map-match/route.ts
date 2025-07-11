import { type NextRequest, NextResponse } from "next/server"
import type { Coordinate } from "@/types/coordinates"

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN

interface MapboxMatchingResponse {
  matchings: Array<{
    geometry: {
      type: "LineString"
      coordinates: number[][]
    }
    distance: number
    duration: number
    confidence: number
  }>
  tracepoints: Array<{
    matchings_index: number
    waypoint_index: number
    alternatives_count: number
    distance_along_geometry: number
  } | null>
}

export async function POST(request: NextRequest) {
  try {
    const { coordinates }: { coordinates: Coordinate[] } = await request.json()

    if (!MAPBOX_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Mapbox access token not configured" }, { status: 500 })
    }

    if (!coordinates || coordinates.length < 2) {
      return NextResponse.json({ error: "At least 2 coordinates are required" }, { status: 400 })
    }

    // Sort coordinates by timestamp to ensure proper order
    const sortedCoordinates = [...coordinates].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // Improved coordinate sampling for better road matching
    const maxCoordinates = 100
    let processedCoordinates = sortedCoordinates

    if (sortedCoordinates.length > maxCoordinates) {
      // Use time-based sampling to maintain route integrity
      const timeSpan =
        new Date(sortedCoordinates[sortedCoordinates.length - 1].timestamp).getTime() -
        new Date(sortedCoordinates[0].timestamp).getTime()
      const timeStep = timeSpan / (maxCoordinates - 1)

      processedCoordinates = []
      let currentTime = new Date(sortedCoordinates[0].timestamp).getTime()

      // Always include first coordinate
      processedCoordinates.push(sortedCoordinates[0])

      for (let i = 1; i < sortedCoordinates.length - 1; i++) {
        const coordTime = new Date(sortedCoordinates[i].timestamp).getTime()
        if (coordTime >= currentTime + timeStep) {
          processedCoordinates.push(sortedCoordinates[i])
          currentTime = coordTime
        }
      }

      // Always include last coordinate
      processedCoordinates.push(sortedCoordinates[sortedCoordinates.length - 1])
    }

    // Format coordinates for Mapbox Map Matching API
    const coordinatesString = processedCoordinates.map((coord) => `${coord.longitude},${coord.latitude}`).join(";")

    // Add radiuses for each coordinate (in meters) - allows for GPS inaccuracy
    const radiuses = processedCoordinates.map(() => "25").join(";")

    // Use Mapbox Map Matching API with improved parameters
    const mapMatchUrl = new URL("https://api.mapbox.com/matching/v5/mapbox/driving/" + coordinatesString)
    mapMatchUrl.searchParams.set("access_token", MAPBOX_ACCESS_TOKEN)
    mapMatchUrl.searchParams.set("geometries", "geojson")
    mapMatchUrl.searchParams.set("overview", "full")
    mapMatchUrl.searchParams.set("radiuses", radiuses)
    mapMatchUrl.searchParams.set("steps", "false")
    mapMatchUrl.searchParams.set("tidy", "true") // Clean up the route
    mapMatchUrl.searchParams.set("annotations", "distance,duration")

    console.log("Attempting map matching with", processedCoordinates.length, "coordinates")

    const response = await fetch(mapMatchUrl.toString())
    const responseText = await response.text()

    if (response.ok) {
      try {
        const data: MapboxMatchingResponse = JSON.parse(responseText)

        if (data.matchings && data.matchings.length > 0) {
          const matching = data.matchings[0]

          // Calculate confidence score
          const validTracepoints = data.tracepoints?.filter((tp) => tp !== null) || []
          const confidence = validTracepoints.length / processedCoordinates.length

          console.log("Map matching successful with confidence:", confidence)

          return NextResponse.json({
            geometry: matching.geometry,
            distance: matching.distance,
            duration: matching.duration,
            confidence: confidence,
            method: "map-matching",
            processedPoints: processedCoordinates.length,
            originalPoints: coordinates.length,
          })
        }
      } catch (parseError) {
        console.error("Failed to parse map matching response:", parseError)
      }
    } else {
      console.error("Map matching failed:", response.status, responseText)
    }

    // Fallback to Directions API with waypoint optimization
    console.log("Falling back to Directions API")

    // For directions API, use fewer points to avoid complexity
    const directionsCoordinates =
      processedCoordinates.length > 25 ? sampleCoordinatesEvenly(processedCoordinates, 25) : processedCoordinates

    const directionsCoordinatesString = directionsCoordinates
      .map((coord) => `${coord.longitude},${coord.latitude}`)
      .join(";")

    const directionsUrl = new URL("https://api.mapbox.com/directions/v5/mapbox/driving/" + directionsCoordinatesString)
    directionsUrl.searchParams.set("access_token", MAPBOX_ACCESS_TOKEN)
    directionsUrl.searchParams.set("geometries", "geojson")
    directionsUrl.searchParams.set("overview", "full")
    directionsUrl.searchParams.set("steps", "false")

    const directionsResponse = await fetch(directionsUrl.toString())

    if (directionsResponse.ok) {
      const directionsData = await directionsResponse.json()

      if (directionsData.routes && directionsData.routes.length > 0) {
        console.log("Directions API successful")

        return NextResponse.json({
          geometry: directionsData.routes[0].geometry,
          distance: directionsData.routes[0].distance,
          duration: directionsData.routes[0].duration,
          method: "directions",
          processedPoints: directionsCoordinates.length,
          originalPoints: coordinates.length,
        })
      }
    }

    // Final fallback: create optimized simple LineString
    console.log("Using simple line fallback")

    const simpleCoordinates =
      processedCoordinates.length > 50 ? sampleCoordinatesEvenly(processedCoordinates, 50) : processedCoordinates

    const simpleGeometry = {
      type: "LineString" as const,
      coordinates: simpleCoordinates.map((coord) => [coord.longitude, coord.latitude]),
    }

    return NextResponse.json({
      geometry: simpleGeometry,
      method: "simple",
      processedPoints: simpleCoordinates.length,
      originalPoints: coordinates.length,
    })
  } catch (error) {
    console.error("Map matching error:", error)
    return NextResponse.json(
      {
        error: "Failed to process route",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Helper function to sample coordinates evenly
function sampleCoordinatesEvenly(coordinates: Coordinate[], targetCount: number): Coordinate[] {
  if (coordinates.length <= targetCount) {
    return coordinates
  }

  const result = [coordinates[0]] // Always include first
  const step = (coordinates.length - 1) / (targetCount - 1)

  for (let i = 1; i < targetCount - 1; i++) {
    const index = Math.round(i * step)
    result.push(coordinates[index])
  }

  result.push(coordinates[coordinates.length - 1]) // Always include last
  return result
}
