import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@weather_favorites';

export const loadFavorites = async (): Promise<string[]> => {
  try {
    const stored = await AsyncStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load favorites', error);
    return [];
  }
};

export const saveFavorites = async (favorites: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Failed to save favorites', error);
  }
};