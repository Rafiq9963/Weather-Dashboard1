import { Unit } from '../types/weather';

export const formatTemperature = (tempInCelsius: number, unit: Unit): string => {
  if (unit === 'F') {
    const fahrenheit = Math.round((tempInCelsius * 9) / 5 + 32);
    return `${fahrenheit}°F`;
  }
  return `${tempInCelsius}°C`;
};