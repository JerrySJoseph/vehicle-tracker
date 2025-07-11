"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, AlertCircle } from "lucide-react"
import type { Coordinate } from "@/types/coordinates"

interface CoordinateFormProps {
  onAddCoordinate: (coordinate: Coordinate) => void
}

export function CoordinateForm({ onAddCoordinate }: CoordinateFormProps) {
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const lat = Number.parseFloat(latitude)
    const lng = Number.parseFloat(longitude)

    if (isNaN(lat) || isNaN(lng)) {
      setError("Please enter valid numbers for latitude and longitude")
      return
    }

    if (lat < -90 || lat > 90) {
      setError("Latitude must be between -90 and 90")
      return
    }

    if (lng < -180 || lng > 180) {
      setError("Longitude must be between -180 and 180")
      return
    }

    const coordinate: Coordinate = {
      id: Math.random().toString(36).substr(2, 9),
      latitude: lat,
      longitude: lng,
      timestamp: new Date().toISOString(),
    }

    onAddCoordinate(coordinate)
    setLatitude("")
    setLongitude("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add Coordinate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="40.7128"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="-74.0060"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Coordinate
          </Button>
        </form>

        <div className="mt-4 text-xs text-muted-foreground">
          <p>
            <strong>Examples:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>New York: 40.7128, -74.0060</li>
            <li>London: 51.5074, -0.1278</li>
            <li>Tokyo: 35.6762, 139.6503</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
