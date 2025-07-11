"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react"
import type { Coordinate } from "@/types/coordinates"

interface FileUploadProps {
  onCoordinatesUpload: (coordinates: Coordinate[]) => void
}

export function FileUpload({ onCoordinatesUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true)
      setError(null)
      setSuccess(null)

      try {
        const text = await file.text()
        const data = JSON.parse(text)

        let coordinates: Coordinate[] = []

        // Handle different JSON formats
        if (Array.isArray(data)) {
          // Direct array of coordinates
          coordinates = data.map((item, index) => {
            if (typeof item === "object" && item.latitude && item.longitude) {
              return {
                id: item.id || generateId(),
                latitude: Number.parseFloat(item.latitude),
                longitude: Number.parseFloat(item.longitude),
                timestamp: item.timestamp || new Date().toISOString(),
              }
            } else if (Array.isArray(item) && item.length >= 2) {
              // Array format [lng, lat] or [lat, lng]
              return {
                id: generateId(),
                latitude: Number.parseFloat(item[0]),
                longitude: Number.parseFloat(item[1]),
                timestamp: new Date().toISOString(),
              }
            }
            throw new Error(`Invalid coordinate format at index ${index}`)
          })
        } else if (data.coordinates && Array.isArray(data.coordinates)) {
          // Nested coordinates
          coordinates = data.coordinates.map((item: any, index: number) => ({
            id: item.id || generateId(),
            latitude: Number.parseFloat(item.latitude || item.lat),
            longitude: Number.parseFloat(item.longitude || item.lng || item.lon),
            timestamp: item.timestamp || new Date().toISOString(),
          }))
        } else if (data.features && Array.isArray(data.features)) {
          // GeoJSON format
          coordinates = data.features
            .filter((feature: any) => feature.geometry?.type === "Point")
            .map((feature: any) => ({
              id: feature.id || generateId(),
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
              timestamp: feature.properties?.timestamp || new Date().toISOString(),
            }))
        } else {
          throw new Error("Unsupported JSON format")
        }

        if (coordinates.length === 0) {
          throw new Error("No valid coordinates found in the file")
        }

        // Validate coordinates
        const validCoordinates = coordinates.filter((coord) => {
          const lat = coord.latitude
          const lng = coord.longitude
          return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
        })

        if (validCoordinates.length === 0) {
          throw new Error("No valid coordinates found (latitude must be -90 to 90, longitude must be -180 to 180)")
        }

        onCoordinatesUpload(validCoordinates)
        setSuccess(`Successfully loaded ${validCoordinates.length} coordinates`)

        if (validCoordinates.length < coordinates.length) {
          setError(`${coordinates.length - validCoordinates.length} invalid coordinates were skipped`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process file")
      } finally {
        setIsProcessing(false)
      }
    },
    [onCoordinatesUpload],
  )

  const handleFileSelect = useCallback(
    (file: File) => {
      if (!file.type.includes("json") && !file.name.endsWith(".json")) {
        setError("Please select a JSON file")
        return
      }

      if (file.size > 100 * 1024 * 1024) {
        // 100MB limit
        setError("File size must be less than 100MB")
        return
      }

      processFile(file)
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        handleFileSelect(files[0])
      }
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Coordinates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Drop your JSON file here</p>
          <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
          <Label htmlFor="file-upload">
            <Button variant="outline" disabled={isProcessing} asChild>
              <span>{isProcessing ? "Processing..." : "Choose File"}</span>
            </Button>
          </Label>
          <Input
            id="file-upload"
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
            }}
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Supported formats:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              Array of objects: <code>[{`{latitude: 40.7128, longitude: -74.0060}`}]</code>
            </li>
            <li>
              Nested format: <code>{`{coordinates: [...]}`}</code>
            </li>
            <li>
              GeoJSON: <code>{`{features: [...]}`}</code>
            </li>
            <li>
              Array of arrays: <code>[[lat, lng], ...]</code>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
