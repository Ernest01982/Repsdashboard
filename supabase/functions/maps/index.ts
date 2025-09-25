const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface GeocodeRequest {
  action: 'geocode';
  payload: { address: string };
}

interface PlacesSearchRequest {
  action: 'places.searchText';
  payload: {
    query: string;
    locationBias?: {
      lat: number;
      lng: number;
      radiusMeters: number;
    };
  };
}

interface RouteOptimizeRequest {
  action: 'route.optimize';
  payload: {
    origin: { lat: number; lng: number };
    waypoints: { lat: number; lng: number }[];
    destination?: { lat: number; lng: number };
  };
}

type MapRequest = GeocodeRequest | PlacesSearchRequest | RouteOptimizeRequest;

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    const { action, payload }: MapRequest = await req.json();

    // Mock implementations for development
    switch (action) {
      case 'geocode': {
        const { address } = payload;
        
        // Mock geocoding response
        const mockResult = {
          formatted_address: address,
          lat: 37.7749 + (Math.random() - 0.5) * 0.01,
          lng: -122.4194 + (Math.random() - 0.5) * 0.01,
          place_id: `mock_place_${Date.now()}`
        };

        return new Response(
          JSON.stringify({ ok: true, result: mockResult }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      case 'places.searchText': {
        const { query, locationBias } = payload;
        
        // Mock places search response
        const mockResults = Array.from({ length: 3 }, (_, i) => ({
          place_id: `mock_place_${i}_${Date.now()}`,
          name: `${query} Location ${i + 1}`,
          address: `${i + 1}00 Mock Street, Mock City, MC 12345`,
          lat: (locationBias?.lat || 37.7749) + (Math.random() - 0.5) * 0.01,
          lng: (locationBias?.lng || -122.4194) + (Math.random() - 0.5) * 0.01,
          types: ['establishment', 'point_of_interest']
        }));

        return new Response(
          JSON.stringify({ ok: true, result: mockResults }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      case 'route.optimize': {
        const { origin, waypoints, destination } = payload;
        
        // Mock route optimization response
        const mockResult = {
          distanceMeters: Math.floor(Math.random() * 50000) + 10000,
          duration: `${Math.floor(Math.random() * 60) + 30}min`,
          waypointOrder: waypoints.map((_, i) => i),
          encodedPolyline: 'mock_encoded_polyline_string'
        };

        return new Response(
          JSON.stringify({ ok: true, result: mockResult }),
          {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ ok: false, error: 'Unknown action' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
    }
  } catch (error) {
    console.error('Maps function error:', error);
    
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
});