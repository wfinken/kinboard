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
  const unit = process.env.KINBOARD_TEMP_UNIT === 'fahrenheit' ? 'fahrenheit' : 'celsius';

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat);
  url.searchParams.set('longitude', lon);
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code');
  url.searchParams.set('temperature_unit', unit);
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '4');

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      current: { temperature_2m: number; weather_code: number };
      daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        weather_code: number[];
      };
    };

    return {
      currentTemp: Math.round(data.current.temperature_2m),
      currentCode: data.current.weather_code,
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
