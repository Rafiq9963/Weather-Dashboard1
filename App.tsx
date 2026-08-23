import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// --- TYPES ---
interface WeatherData {
  id: number;
  cityName: string;
  temperature: number;
  humidity: number;
  condition: string;
  description: string;
  icon: string;
}

interface ForecastDay {
  date: string;
  dayName: string;
  temperature: number;
  icon: string;
  condition: string;
}

type Unit = 'C' | 'F';

// --- CONFIG & API ---
const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';
const FAVORITES_KEY = '@weather_favorites';

const fetchWeatherByCity = async (city: string): Promise<WeatherData> => {
  const response = await fetch(
    `${BASE_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('City not found. Please check spelling.');
    }
    throw new Error('Failed to fetch current weather data.');
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

const fetch5DayForecast = async (city: string): Promise<ForecastDay[]> => {
  const response = await fetch(
    `${FORECAST_URL}?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  return parseDailyForecast(data.list);
};

const fetchWeatherByCoords = async (lat: number, lon: number): Promise<WeatherData> => {
  const response = await fetch(
    `${BASE_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );

  if (!response.ok) throw new Error('Failed to fetch local weather data.');

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

const fetchForecastByCoords = async (lat: number, lon: number): Promise<ForecastDay[]> => {
  const response = await fetch(
    `${FORECAST_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  return parseDailyForecast(data.list);
};

const parseDailyForecast = (list: any[]): ForecastDay[] => {
  const dailyMap: { [date: string]: any } = {};

  list.forEach((item: any) => {
    const dateStr = item.dt_txt.split(' ')[0];
    if (!dailyMap[dateStr] || item.dt_txt.includes('12:00:00')) {
      dailyMap[dateStr] = item;
    }
  });

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return Object.keys(dailyMap)
    .slice(0, 5)
    .map((dateKey) => {
      const item = dailyMap[dateKey];
      const d = new Date(dateKey);
      return {
        date: dateKey,
        dayName: daysOfWeek[d.getDay()],
        temperature: Math.round(item.main.temp),
        icon: item.weather[0].icon,
        condition: item.weather[0].main,
      };
    });
};

const formatTemperature = (tempInCelsius: number, unit: Unit): string => {
  if (unit === 'F') {
    const fahrenheit = Math.round((tempInCelsius * 9) / 5 + 32);
    return `${fahrenheit}°F`;
  }
  return `${tempInCelsius}°C`;
};

export default function App() {
  const [query, setQuery] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [unit, setUnit] = useState<Unit>('C');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dynamic color palette
  const theme = {
    background: isDarkMode ? '#121212' : '#f0f2f5',
    card: isDarkMode ? '#1e1e1e' : '#ffffff',
    textPrimary: isDarkMode ? '#ffffff' : '#1a1a1a',
    textSecondary: isDarkMode ? '#a0a0a0' : '#666666',
    border: isDarkMode ? '#2c2c2c' : '#e1e4e8',
    inputBg: isDarkMode ? '#1e1e1e' : '#ffffff',
    toggleBtn: isDarkMode ? '#333333' : '#e4e6eb',
    toggleText: isDarkMode ? '#ffffff' : '#333333',
  };

  const fetchCurrentLocationWeather = async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        handleSearch('Bengaluru');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const [weatherData, forecastData] = await Promise.all([
        fetchWeatherByCoords(latitude, longitude),
        fetchForecastByCoords(latitude, longitude),
      ]);

      setWeather(weatherData);
      setForecast(forecastData);
    } catch (err: any) {
      handleSearch('Bengaluru');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (weather?.cityName) {
      await handleSearch(weather.cityName);
    } else {
      await fetchCurrentLocationWeather();
    }
    setRefreshing(false);
  };

  useEffect(() => {
    AsyncStorage.getItem(FAVORITES_KEY).then((stored) => {
      if (stored) setFavorites(JSON.parse(stored));
    });
    fetchCurrentLocationWeather();
  }, []);

  const handleSearch = async (cityName?: string) => {
    const cityToSearch = cityName || query.trim();
    if (!cityToSearch) return;

    setLoading(true);
    setError(null);
    try {
      const [weatherData, forecastData] = await Promise.all([
        fetchWeatherByCity(cityToSearch),
        fetch5DayForecast(cityToSearch),
      ]);
      setWeather(weatherData);
      setForecast(forecastData);
      setQuery('');
    } catch (err: any) {
      setError(err.message || 'Error fetching data');
      setWeather(null);
      setForecast([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (cityName: string) => {
    let updated: string[];
    if (favorites.includes(cityName)) {
      updated = favorites.filter((item) => item !== cityName);
    } else {
      updated = [...favorites, cityName];
    }
    setFavorites(updated);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  };

  const isCurrentCityFavorite = weather ? favorites.includes(weather.cityName) : false;

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
          />
        }
      >
        <View style={styles.container}>
          {/* Header Controls: Title, Dark Mode Toggle & Unit Switcher */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Weather Dashboard</Text>
            <View style={styles.headerControls}>
              <TouchableOpacity
                style={[styles.themeToggle, { backgroundColor: theme.toggleBtn }]}
                onPress={() => setIsDarkMode((prev) => !prev)}
              >
                <Text style={[styles.themeText, { color: theme.toggleText }]}>
                  {isDarkMode ? '☀️ Light' : '🌙 Dark'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unitToggle}
                onPress={() => setUnit(unit === 'C' ? 'F' : 'C')}
              >
                <Text style={styles.unitText}>°{unit}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Row */}
          <View style={styles.searchRow}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.border,
                  color: theme.textPrimary,
                },
              ]}
              placeholder="Enter city (e.g., London, Tokyo)"
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={() => handleSearch()}>
              <Text style={styles.btnText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.locBtn,
                { backgroundColor: theme.inputBg, borderColor: theme.border },
              ]}
              onPress={fetchCurrentLocationWeather}
            >
              <Text style={styles.locBtnText}>📍</Text>
            </TouchableOpacity>
          </View>

          {/* Error Feedback */}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {/* Loading Indicator */}
          {loading && <ActivityIndicator size="large" color="#007AFF" style={{ margin: 20 }} />}

          {/* Current Weather Card */}
          {weather && !loading && (
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cityName, { color: theme.textPrimary }]}>
                  {weather.cityName}
                </Text>
                <TouchableOpacity onPress={() => toggleFavorite(weather.cityName)}>
                  <Text style={styles.favIcon}>{isCurrentCityFavorite ? '★' : '☆'}</Text>
                </TouchableOpacity>
              </View>

              <Image
                style={styles.weatherIcon}
                source={{ uri: `https://openweathermap.org/img/wn/${weather.icon}@2x.png` }}
              />
              <Text style={[styles.temp, { color: theme.textPrimary }]}>
                {formatTemperature(weather.temperature, unit)}
              </Text>
              <Text style={[styles.condition, { color: theme.textSecondary }]}>
                {weather.condition} ({weather.description})
              </Text>
              <Text style={[styles.humidity, { color: theme.textSecondary }]}>
                Humidity: {weather.humidity}%
              </Text>
            </View>
          )}

          {/* 5-Day Forecast Grid */}
          {forecast.length > 0 && !loading && (
            <View style={styles.forecastSection}>
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>5-Day Forecast</Text>
              <View style={styles.forecastGrid}>
                {forecast.map((item) => (
                  <View
                    key={item.date}
                    style={[styles.forecastCard, { backgroundColor: theme.card }]}
                  >
                    <Text style={[styles.forecastDay, { color: theme.textSecondary }]}>
                      {item.dayName}
                    </Text>
                    <Image
                      style={styles.forecastIcon}
                      source={{ uri: `https://openweathermap.org/img/wn/${item.icon}.png` }}
                    />
                    <Text style={[styles.forecastTemp, { color: theme.textPrimary }]}>
                      {formatTemperature(item.temperature, unit)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Saved Favourites */}
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Saved Favourites</Text>
          {favorites.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No saved cities yet.
            </Text>
          ) : (
            <FlatList
              data={favorites}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.favChip,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => handleSearch(item)}
                >
                  <Text style={styles.favChipText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  themeText: {
    fontWeight: '600',
    fontSize: 13,
  },
  unitToggle: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  unitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  locBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  locBtnText: {
    fontSize: 18,
  },
  errorText: {
    color: '#d9534f',
    marginVertical: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginVertical: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  cityName: {
    fontSize: 22,
    fontWeight: '700',
  },
  favIcon: {
    fontSize: 28,
    color: '#f5a623',
  },
  weatherIcon: {
    width: 100,
    height: 100,
    marginVertical: -8,
  },
  temp: {
    fontSize: 44,
    fontWeight: '800',
  },
  condition: {
    fontSize: 16,
    textTransform: 'capitalize',
    marginTop: 4,
  },
  humidity: {
    fontSize: 14,
    marginTop: 6,
  },
  forecastSection: {
    marginBottom: 16,
  },
  forecastGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  forecastCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  forecastDay: {
    fontSize: 13,
    fontWeight: '600',
  },
  forecastIcon: {
    width: 42,
    height: 42,
    marginVertical: 2,
  },
  forecastTemp: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  emptyText: {
    fontStyle: 'italic',
  },
  favChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  favChipText: {
    fontWeight: '600',
    color: '#007AFF',
  },
});