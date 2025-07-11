export interface Coordinate {
  id: string
  latitude: number
  longitude: number
  timestamp: string
}

export interface RouteData {
  geometry: {
    type: "LineString"
    coordinates: number[][]
  }
  distance?: number
  duration?: number
}
