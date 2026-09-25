// Open-Meteo is free and requires no API key: https://open-meteo.com/
const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌦️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '🌨️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌦️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm w/ hail', icon: '⛈️' },
  99: { label: 'Thunderstorm w/ hail', icon: '⛈️' },
};

export function describeWeatherCode(code: number) {
  return WMO_CODES[code] ?? { label: 'Unknown', icon: '❓' };
}

export interface WeatherData {
  currentTemp: number;
  currentCode: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  today: {
    high: number;
    low: number;
    precipChance: number;
  };
  /** Next 3 days, not including today. */
  forecast: Array<{
    date: string;
    high: number;
    low: number;
    code: number;
  }>;
}

export async function fetchWeather(): Promise<WeatherData | null> {
  const lat = process.env.KINBOARD_LAT ?? '40.7128';
  const lon = process.env.KINBOARD_LON ?? '-74.0060';
  const imperial = process.env.KINBOARD_TEMP_UNIT === 'fahrenheit';
  const unit = imperial ? 'fahrenheit' : 'celsius';

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set(
    'current',
    'temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
  );
  url.searchParams.set('temperature_unit', unit);
  url.searchParams.set('wind_speed_unit', imperial ? 'mph' : 'kmh');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '4');

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current: {
        temperature_2m: number;
        weather_code: number;
        apparent_temperature: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
      };
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
        precipitation_probability_max: number[];
      };
    };

    return {
      currentTemp: Math.round(data.current.temperature_2m),
      currentCode: data.current.weather_code,
      feelsLike: Math.round(data.current.apparent_temperature),
      humidity: Math.round(data.current.relative_humidity_2m),
      windSpeed: Math.round(data.current.wind_speed_10m),
      today: {
        high: Math.round(data.daily.temperature_2m_max[0]),
        low: Math.round(data.daily.temperature_2m_min[0]),
        precipChance: data.daily.precipitation_probability_max[0],
      },
      forecast: data.daily.time.slice(1, 4).map((date, i) => ({
        date,
        high: Math.round(data.daily.temperature_2m_max[i + 1]),
        low: Math.round(data.daily.temperature_2m_min[i + 1]),
        code: data.daily.weather_code[i + 1],
      })),
    };
  } catch {
    return null;
  }
}
