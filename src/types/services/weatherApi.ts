import { WeatherData } from '../types/weather';

const API_KEY = '7d9ce73717bb9bdf7a37de8378915f1b';
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

export const fetchWeatherByCity = async (city: string): Promise<WeatherData> => {
  const response = await fetch(
    `${BASE_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('City not found. Please check spelling.');
    }
    throw new Error('Failed to fetch weather data.');
  }

  const data = await response.json();
  return {
    id: data.id,
    cityName: data.name,
    temperature: Math.round(data.main.temp),
    humidity: data.main.humidity,
    condition: data.weather[0].main,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
  };
};