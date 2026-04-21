const BASE = "https://api.open-meteo.com/v1/forecast";

// Lat/lng per Jolpica circuitId
export const CIRCUIT_COORDS: Record<string, { lat: number; lng: number }> = {
  albert_park:   { lat: -37.8497, lng: 144.9680 },
  bahrain:       { lat: 26.0325,  lng: 50.5106  },
  jeddah:        { lat: 21.6319,  lng: 39.1044  },
  suzuka:        { lat: 34.8431,  lng: 136.5407 },
  shanghai:      { lat: 31.3389,  lng: 121.2200 },
  miami:         { lat: 25.9581,  lng: -80.2389 },
  monaco:        { lat: 43.7347,  lng: 7.4205   },
  catalunya:     { lat: 41.5700,  lng: 2.2611   },
  villeneuve:    { lat: 45.5000,  lng: -73.5228 },
  red_bull_ring: { lat: 47.2197,  lng: 14.7647  },
  silverstone:   { lat: 52.0786,  lng: -1.0169  },
  spa:           { lat: 50.4372,  lng: 5.9714   },
  hungaroring:   { lat: 47.5789,  lng: 19.2486  },
  zandvoort:     { lat: 52.3888,  lng: 4.5409   },
  monza:         { lat: 45.6156,  lng: 9.2811   },
  baku:          { lat: 40.3725,  lng: 49.8533  },
  marina_bay:    { lat: 1.2914,   lng: 103.8639 },
  americas:      { lat: 30.1328,  lng: -97.6411 },
  rodriguez:     { lat: 19.4042,  lng: -99.0907 },
  interlagos:    { lat: -23.7036, lng: -46.6997 },
  las_vegas:     { lat: 36.1699,  lng: -115.1398},
  losail:        { lat: 25.4900,  lng: 51.4542  },
  yas_marina:    { lat: 24.4672,  lng: 54.6031  },
  imola:         { lat: 44.3439,  lng: 11.7167  },
  portimao:      { lat: 37.2270,  lng: -8.6267  },
};

export interface CircuitWeather {
  tempC: number;
  rainPct: number;
  condition: string;
}

export async function getCircuitWeather(
  circuitId: string,
  raceDate: string
): Promise<CircuitWeather | null> {
  const coords = CIRCUIT_COORDS[circuitId];
  if (!coords) return null;

  try {
    const url = new URL(BASE);
    url.searchParams.set("latitude", String(coords.lat));
    url.searchParams.set("longitude", String(coords.lng));
    url.searchParams.set("daily", "temperature_2m_max,precipitation_probability_max,weathercode");
    url.searchParams.set("timezone", "auto");
    url.searchParams.set("start_date", raceDate);
    url.searchParams.set("end_date", raceDate);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json() as {
      daily?: {
        temperature_2m_max?: number[];
        precipitation_probability_max?: number[];
        weathercode?: number[];
      };
    };
    const daily = data?.daily;
    if (!daily) return null;

    return {
      tempC: Math.round(daily.temperature_2m_max?.[0] ?? 0),
      rainPct: Math.round(daily.precipitation_probability_max?.[0] ?? 0),
      condition: wmoToCondition(daily.weathercode?.[0] ?? 0),
    };
  } catch {
    return null;
  }
}

function wmoToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3)  return "Partly cloudy";
  if (code <= 9)  return "Foggy";
  if (code <= 19) return "Drizzle";
  if (code <= 29) return "Rain";
  if (code <= 39) return "Snow";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Showers";
  if (code <= 99) return "Thunderstorm";
  return "Thunderstorm";
}
