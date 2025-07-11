"use client"

import type React from "react"

import { useMemo } from "react"
import { FixedSizeList as List } from "react-window"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, MapPin, Clock } from "lucide-react"
import type { Coordinate } from "@/types/coordinates"

interface CoordinateListProps {
  coordinates: Coordinate[]
  selectedCoordinate: Coordinate | null
  onCoordinateSelect: (coordinate: Coordinate) => void
  onDeleteCoordinate: (id: string) => void
}

interface CoordinateItemProps {
  index: number
  style: React.CSSProperties
  data: {
    coordinates: Coordinate[]
    selectedCoordinate: Coordinate | null
    onCoordinateSelect: (coordinate: Coordinate) => void
    onDeleteCoordinate: (id: string) => void
  }
}

function CoordinateItem({ index, style, data }: CoordinateItemProps) {
  const { coordinates, selectedCoordinate, onCoordinateSelect, onDeleteCoordinate } = data
  const coordinate = coordinates[index]
  const isSelected = selectedCoordinate?.id === coordinate.id

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div style={style} className="px-2 py-1">
      <div
        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
        }`}
        onClick={() => onCoordinateSelect(coordinate)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
              <Badge variant="outline" className="text-xs">
                #{index + 1}
              </Badge>
            </div>
            <div className="text-sm font-mono text-muted-foreground">
              <div>Lat: {coordinate.latitude.toFixed(6)}</div>
              <div>Lng: {coordinate.longitude.toFixed(6)}</div>
            </div>
            {coordinate.timestamp && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimestamp(coordinate.timestamp)}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onDeleteCoordinate(coordinate.id)
            }}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CoordinateList({
  coordinates,
  selectedCoordinate,
  onCoordinateSelect,
  onDeleteCoordinate,
}: CoordinateListProps) {
  const itemData = useMemo(
    () => ({
      coordinates,
      selectedCoordinate,
      onCoordinateSelect,
      onDeleteCoordinate,
    }),
    [coordinates, selectedCoordinate, onCoordinateSelect, onDeleteCoordinate],
  )

  if (coordinates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Coordinates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No coordinates added yet</p>
            <p className="text-sm">Upload a JSON file or add coordinates manually</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Coordinates ({coordinates.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <List
          height={320}
          itemCount={coordinates.length}
          itemSize={120}
          itemData={itemData}
          className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        >
          {CoordinateItem}
        </List>
      </CardContent>
    </Card>
  )
}
