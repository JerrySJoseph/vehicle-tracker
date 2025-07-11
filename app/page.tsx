"use client"

import { useState, useCallback } from "react"
import { MapComponent } from "@/components/map-component"
import { CoordinateList } from "@/components/coordinate-list"
import { FileUpload } from "@/components/file-upload"
import { CoordinateForm } from "@/components/coordinate-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Route, Upload, Plus } from "lucide-react"
import type { Coordinate } from "@/types/coordinates"

export default function VehicleTracker() {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([])
  const [selectedCoordinate, setSelectedCoordinate] = useState<Coordinate | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [routeData, setRouteData] = useState<any>(null)

  const handleCoordinatesUpload = useCallback((newCoordinates: Coordinate[]) => {
    setCoordinates(newCoordinates)
    setSelectedCoordinate(null)
  }, [])

  const handleAddCoordinate = useCallback((coordinate: Coordinate) => {
    setCoordinates((prev) => [...prev, coordinate])
  }, [])

  const handleDeleteCoordinate = useCallback(
    (id: string) => {
      setCoordinates((prev) => prev.filter((coord) => coord.id !== id))
      if (selectedCoordinate?.id === id) {
        setSelectedCoordinate(null)
      }
    },
    [selectedCoordinate],
  )

  const handleCoordinateSelect = useCallback((coordinate: Coordinate) => {
    setSelectedCoordinate(coordinate)
  }, [])

  const handleSnapToRoads = useCallback(async () => {
    if (coordinates.length < 2) return

    setIsLoading(true)
    try {
      const response = await fetch("/api/map-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates }),
      })

      if (response.ok) {
        const data = await response.json()
        setRouteData(data)

        // Show success message with method used
        const methodName =
          data.method === "map-matching"
            ? "road snapping"
            : data.method === "directions"
              ? "route optimization"
              : "simple path"

        console.log(`Route processed using ${methodName}`, {
          originalPoints: data.originalPoints,
          processedPoints: data.processedPoints,
          confidence: data.confidence,
        })
      } else {
        const errorData = await response.json()
        console.error("Road snapping failed:", errorData)
      }
    } catch (error) {
      console.error("Error snapping to roads:", error)
    } finally {
      setIsLoading(false)
    }
  }, [coordinates])

  const handleClearAll = useCallback(() => {
    setCoordinates([])
    setSelectedCoordinate(null)
    setRouteData(null)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Route className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Vehicle Path Tracker</h1>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {coordinates.length} coordinates
              </Badge>
              {coordinates.length > 1 && (
                <Button variant='secondary' onClick={handleSnapToRoads} disabled={isLoading} className="flex items-center gap-2">
                  <Route className="h-4 w-4" />
                  {isLoading ? "Processing..." : "Snap to Roads"}
                  {routeData && (
                    <Badge variant="outline" className="ml-1">
                      {routeData.method === "map-matching"
                        ? "Snapped"
                        : routeData.method === "directions"
                          ? "Routed"
                          : "Simple"}
                    </Badge>
                  )}
                </Button>
              )}
              {coordinates.length > 0 && (
                <Button variant="outline" onClick={handleClearAll}>
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Route Visualization
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[calc(100%-60px)]">
                <MapComponent
                  coordinates={coordinates}
                  selectedCoordinate={selectedCoordinate}
                  routeData={routeData}
                  onCoordinateSelect={handleCoordinateSelect}
                />
              </CardContent>
            </Card>
          </div>

          {/* Controls Section */}
          <div className="space-y-6">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <FileUpload onCoordinatesUpload={handleCoordinatesUpload} />
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <CoordinateForm onAddCoordinate={handleAddCoordinate} />
              </TabsContent>
            </Tabs>

            <CoordinateList
              coordinates={coordinates}
              selectedCoordinate={selectedCoordinate}
              onCoordinateSelect={handleCoordinateSelect}
              onDeleteCoordinate={handleDeleteCoordinate}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
