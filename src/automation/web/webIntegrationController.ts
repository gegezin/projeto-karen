import axios from 'axios';

export interface WeatherData {
  city: string;
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  forecast?: any[];
}

export interface CurrencyData {
  from: string;
  to: string;
  rate: number;
  value?: number;
}

export class WebIntegrationController {
  private weatherApiKey = 'YOUR_OPENWEATHERMAP_API_KEY'; // Usuário precisará fornecer ou usaremos uma pública se possível

  /**
   * Obtém o clima de uma cidade
   */
  async getWeather(city: string): Promise<WeatherData> {
    try {
      // Usando Open-Meteo (Grátis, sem API Key necessária para geocoding básico + weather)
      // Primeiro: Geocoding para pegar lat/lon
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&format=json`;
      const geoRes = await axios.get(geoUrl);
      
      if (!geoRes.data.results || geoRes.data.results.length === 0) {
        throw new Error('Cidade não encontrada');
      }

      const { latitude, longitude, name } = geoRes.data.results[0];

      // Segundo: Clima atual
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`;
      const weatherRes = await axios.get(weatherUrl);

      return {
        city: name,
        temperature: weatherRes.data.current_weather.temperature,
        description: this.getWeatherDescription(weatherRes.data.current_weather.weathercode),
        humidity: 0, // Open-Meteo precisa de params extras para humidity
        windSpeed: weatherRes.data.current_weather.windspeed
      };
    } catch (error) {
      console.error('❌ Erro ao buscar clima:', error);
      throw error;
    }
  }

  /**
   * Obtém cotação de moedas
   */
  async getCurrencyRate(from: string, to: string): Promise<CurrencyData> {
    try {
      const url = `https://economia.awesomeapi.com.br/last/${from.toUpperCase()}-${to.toUpperCase()}`;
      const res = await axios.get(url);
      const pair = `${from.toUpperCase()}${to.toUpperCase()}`;
      const data = res.data[pair];

      return {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate: parseFloat(data.bid)
      };
    } catch (error) {
      console.error('❌ Erro ao buscar cotação:', error);
      throw error;
    }
  }

  /**
   * Tradução instantânea (Usando MyMemory API - Grátis)
   */
  async translateText(text: string, from: string, to: string): Promise<string> {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
      const res = await axios.get(url);
      return res.data.responseData.translatedText;
    } catch (error) {
      console.error('❌ Erro na tradução:', error);
      throw error;
    }
  }

  private getWeatherDescription(code: number): string {
    const codes: Record<number, string> = {
      0: 'Céu limpo',
      1: 'Principalmente limpo',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      45: 'Nevoeiro',
      48: 'Nevoeiro com geada',
      51: 'Chuvisco leve',
      53: 'Chuvisco moderado',
      55: 'Chuvisco denso',
      61: 'Chuva leve',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      71: 'Neve leve',
      73: 'Neve moderada',
      75: 'Neve forte',
      80: 'Pancadas de chuva leve',
      81: 'Pancadas de chuva moderada',
      82: 'Pancadas de chuva forte',
      95: 'Trovoada',
    };
    return codes[code] || 'Desconhecido';
  }
}

export const webIntegrationController = new WebIntegrationController();
