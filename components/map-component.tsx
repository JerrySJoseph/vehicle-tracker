"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import type { Coordinate } from "@/types/coordinates"
import "mapbox-gl/dist/mapbox-gl.css"

// You'll need to set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "your-mapbox-token-here"

interface MapComponentProps {
  coordinates: Coordinate[]
  selectedCoordinate: Coordinate | null
  routeData: any
  onCoordinateSelect: (coordinate: Coordinate) => void
}

interface MapMatchingResponse {
  geometry: any
  method: string
  confidence: number
  processedPoints: number
  originalPoints: number
}

export function MapComponent({ coordinates, selectedCoordinate, routeData, onCoordinateSelect }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isProcessingRoute, setIsProcessingRoute] = useState(false)
  const [matchedRouteData, setMatchedRouteData] = useState<MapMatchingResponse | null>(null)

  // Map Matching API function
  const performMapMatching = async (coordinates: Coordinate[]): Promise<MapMatchingResponse | null> => {
    if (coordinates.length < 2) return null

    try {
      setIsProcessingRoute(true)
      
      // Prepare coordinates for Map Matching API
      const coordinatesString = coordinates
        .map(coord => `${coord.longitude},${coord.latitude}`)
        .join(';')

      // Prepare radiuses (search radius for each point in meters)
      const radiuses = coordinates.map(() => 25).join(';')

      const mapMatchingUrl = `https://api.mapbox.com/matching/v5/mapbox/driving/${coordinatesString}?geometries=geojson&radiuses=${radiuses}&steps=false&overview=full&annotations=distance,duration&access_token=${mapboxgl.accessToken}`

      const response = await fetch(mapMatchingUrl)
      
      if (!response.ok) {
        throw new Error(`Map Matching API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.matchings && data.matchings.length > 0) {
        const matching = data.matchings[0]
        
        return {
          geometry: matching.geometry,
          method: 'map-matching',
          confidence: matching.confidence || 0.8,
          processedPoints: matching.legs?.length || 0,
          originalPoints: coordinates.length
        }
      }

      return null
    } catch (error) {
      console.error('Map Matching failed:', error)
      return null
    } finally {
      setIsProcessingRoute(false)
    }
  }

  // Batch processing for large coordinate sets
  const performBatchMapMatching = async (coordinates: Coordinate[]): Promise<MapMatchingResponse | null> => {
    if (coordinates.length < 2) return null

    const maxPointsPerRequest = 100 // Mapbox limit
    const batches: Coordinate[][] = []
    
    // Split coordinates into batches
    for (let i = 0; i < coordinates.length; i += maxPointsPerRequest) {
      const batch = coordinates.slice(i, i + maxPointsPerRequest)
      if (batch.length >= 2) { // Need at least 2 points for matching
        batches.push(batch)
      }
    }

    if (batches.length === 0) return null

    try {
      setIsProcessingRoute(true)
      
      // Process all batches
      const batchPromises = batches.map(batch => performMapMatching(batch))
      const batchResults = await Promise.all(batchPromises)
      
      // Filter successful results
      const successfulResults = batchResults.filter(result => result !== null) as MapMatchingResponse[]
      
      if (successfulResults.length === 0) return null

      // Combine geometries from all batches
      const combinedCoordinates: number[][] = []
      let totalConfidence = 0
      let totalProcessedPoints = 0

      successfulResults.forEach(result => {
        if (result.geometry.type === 'LineString') {
          combinedCoordinates.push(...result.geometry.coordinates)
          totalConfidence += result.confidence
          totalProcessedPoints += result.processedPoints
        }
      })

      return {
        geometry: {
          type: 'LineString',
          coordinates: combinedCoordinates
        },
        method: 'map-matching',
        confidence: totalConfidence / successfulResults.length,
        processedPoints: totalProcessedPoints,
        originalPoints: coordinates.length
      }
    } catch (error) {
      console.error('Batch Map Matching failed:', error)
      return null
    } finally {
      setIsProcessingRoute(false)
    }
  }

  // Fallback to Directions API if Map Matching fails
  const performDirectionsMatching = async (coordinates: Coordinate[]): Promise<MapMatchingResponse | null> => {
    if (coordinates.length < 2) return null

    try {
      // Use key waypoints for directions (start, middle points, end)
      const waypoints: Coordinate[] = []
      
      // Always include start and end
      waypoints.push(coordinates[0])
      
      // Add intermediate points (max 25 waypoints for Directions API)
      if (coordinates.length > 2) {
        const step = Math.max(1, Math.floor(coordinates.length / 23)) // Leave room for start/end
        for (let i = step; i < coordinates.length - 1; i += step) {
          waypoints.push(coordinates[i])
        }
      }
      
      waypoints.push(coordinates[coordinates.length - 1])

      const coordinatesString = waypoints
        .map(coord => `${coord.longitude},${coord.latitude}`)
        .join(';')

      const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&overview=full&steps=false&access_token=${mapboxgl.accessToken}`

      const response = await fetch(directionsUrl)
      
      if (!response.ok) {
        throw new Error(`Directions API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        
        return {
          geometry: route.geometry,
          method: 'directions',
          confidence: 0.9, // Directions API typically has high confidence
          processedPoints: waypoints.length,
          originalPoints: coordinates.length
        }
      }

      return null
    } catch (error) {
      console.error('Directions API failed:', error)
      return null
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128], // Default to NYC
      zoom: 10,
      attributionControl: false,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right")
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right")

    map.current.on("load", () => {
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Process coordinates with Map Matching when they change
  useEffect(() => {
    if (coordinates.length >= 2 && !routeData) {
      const processRoute = async () => {
        let matchedRoute: MapMatchingResponse | null = null

        // Try Map Matching first
        if (coordinates.length <= 100) {
          matchedRoute = await performMapMatching(coordinates)
        } else {
          // Use batch processing for large datasets
          matchedRoute = await performBatchMapMatching(coordinates)
        }

        // Fallback to Directions API if Map Matching fails
        if (!matchedRoute) {
          console.log('Map Matching failed, trying Directions API...')
          matchedRoute = await performDirectionsMatching(coordinates)
        }

        if (matchedRoute) {
          setMatchedRouteData(matchedRoute)
        }
      }

      processRoute()
    }
  }, [coordinates, routeData])

  // Update markers and route when coordinates change
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Clear existing layers first (order matters!)
    const layersToRemove = ["clusters", "cluster-count", "coordinates-layer"]
    layersToRemove.forEach(layerId => {
      if (map.current!.getLayer(layerId)) {
        map.current!.removeLayer(layerId)
      }
    })

    // Clear existing sources after removing all dependent layers
    if (map.current.getSource("coordinates")) {
      map.current.removeSource("coordinates")
    }
    if (map.current.getSource("route")) {
      if (map.current.getLayer("route-layer")) {
        map.current.removeLayer("route-layer")
      }
      map.current.removeSource("route")
    }

    if (coordinates.length === 0) return

    // Add coordinate points
    const geojsonData = {
      type: "FeatureCollection" as const,
      features: coordinates.map((coord, index) => ({
        type: "Feature" as const,
        properties: {
          id: coord.id,
          timestamp: coord.timestamp,
          index: index,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [coord.longitude, coord.latitude],
        },
      })),
    }

    map.current.addSource("coordinates", {
      type: "geojson",
      data: geojsonData,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    })

    // Add clusters
    map.current.addLayer({
      id: "clusters",
      type: "circle",
      source: "coordinates",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#51bbd6", 100, "#f1f075", 750, "#f28cb1"],
        "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
      },
    })

    // Add cluster count labels
    map.current.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "coordinates",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    })

    // Add individual points
    map.current.addLayer({
      id: "coordinates-layer",
      type: "circle",
      source: "coordinates",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#3b82f6",
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
      },
    })

    // Use either provided routeData or matched route data
    const currentRouteData = routeData || matchedRouteData

    // Add route line with different styles based on method
    if (currentRouteData && currentRouteData.geometry) {
      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {
            method: currentRouteData.method,
            confidence: currentRouteData.confidence,
          },
          geometry: currentRouteData.geometry,
        },
      })

      // Different styles based on route method
      const routeColor =
        currentRouteData.method === "map-matching"
          ? "#10b981"
          : // Green for map-matched
            currentRouteData.method === "directions"
            ? "#f59e0b"
            : // Orange for directions
              "#6b7280" // Gray for simple

      const routeWidth = currentRouteData.method === "map-matching" ? 5 : currentRouteData.method === "directions" ? 4 : 3

      map.current.addLayer({
        id: "route-layer",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": routeColor,
          "line-width": routeWidth,
          "line-opacity": 0.8,
        },
      })

      // Add route method indicator
      if (currentRouteData.method) {
        console.log(`Route rendered using: ${currentRouteData.method}`, {
          confidence: currentRouteData.confidence,
          processedPoints: currentRouteData.processedPoints,
          originalPoints: currentRouteData.originalPoints,
        })
      }
    } else if (coordinates.length > 1) {
      // Create simple line from coordinates if no route data
      const lineCoordinates = coordinates.map((coord) => [coord.longitude, coord.latitude])

      map.current.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { method: "raw" },
          geometry: {
            type: "LineString",
            coordinates: lineCoordinates,
          },
        },
      })

      map.current.addLayer({
        id: "route-layer",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#ef4444", // Red for raw GPS
          "line-width": 2,
          "line-opacity": 0.6,
          "line-dasharray": [2, 2], // Dashed line for raw GPS
        },
      })
    }

    // Fit map to coordinates
    if (coordinates.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      coordinates.forEach((coord) => {
        bounds.extend([coord.longitude, coord.latitude])
      })
      map.current.fitBounds(bounds, { padding: 50 })
    }

    // Add click handler for points
    map.current.on("click", "coordinates-layer", (e) => {
      if (e.features && e.features[0]) {
        const feature = e.features[0]
        const coordId = feature.properties?.id
        const coordinate = coordinates.find((c) => c.id === coordId)
        if (coordinate) {
          onCoordinateSelect(coordinate)
        }
      }
    })

    // Change cursor on hover
    map.current.on("mouseenter", "coordinates-layer", () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = "pointer"
      }
    })

    map.current.on("mouseleave", "coordinates-layer", () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = ""
      }
    })
  }, [coordinates, routeData, matchedRouteData, mapLoaded, onCoordinateSelect])

  // Highlight selected coordinate
  useEffect(() => {
    if (!map.current || !mapLoaded || !selectedCoordinate) return

    // Remove existing highlight
    if (map.current.getSource("selected-coordinate")) {
      map.current.removeLayer("selected-coordinate-layer")
      map.current.removeSource("selected-coordinate")
    }

    // Add highlight for selected coordinate
    map.current.addSource("selected-coordinate", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Point",
          coordinates: [selectedCoordinate.longitude, selectedCoordinate.latitude],
        },
      },
    })

    map.current.addLayer({
      id: "selected-coordinate-layer",
      type: "circle",
      source: "selected-coordinate",
      paint: {
        "circle-color": "#ef4444",
        "circle-radius": 10,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    })

    // Center map on selected coordinate
    map.current.flyTo({
      center: [selectedCoordinate.longitude, selectedCoordinate.latitude],
      zoom: 15,
    })
  }, [selectedCoordinate, mapLoaded])

  const currentRouteData = routeData || matchedRouteData

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full rounded-lg" />
      
      {/* Route processing indicator */}
      {isProcessingRoute && (
        <div className="absolute top-4 left-4 bg-blue-500/90 text-white backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm">Processing route...</span>
          </div>
        </div>
      )}

      {/* Route info panel */}
      {currentRouteData && !isProcessingRoute && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium mb-2">Route Type</div>
          <div className="flex items-center gap-2 text-xs">
            <div
              className="w-4 h-1 rounded"
              style={{
                backgroundColor:
                  currentRouteData.method === "map-matching"
                    ? "#10b981"
                    : currentRouteData.method === "directions"
                      ? "#f59e0b"
                      : "#6b7280",
              }}
            />
            <span>
              {currentRouteData.method === "map-matching"
                ? "Road Snapped"
                : currentRouteData.method === "directions"
                  ? "Route Optimized"
                  : "Simple Path"}
            </span>
            {currentRouteData.confidence && (
              <span className="text-muted-foreground">
                ({Math.round(currentRouteData.confidence * 100)}% match)
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {currentRouteData.originalPoints} GPS points → {currentRouteData.processedPoints} route points
          </div>
        </div>
      )}

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  )
}