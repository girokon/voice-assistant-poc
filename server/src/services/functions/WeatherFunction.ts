import { BaseFunction, ToolFunction } from '../types.js';
import fetch from 'node-fetch';

export class WeatherFunction implements BaseFunction {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.TOMORROW_API_KEY;
    if (!apiKey) {
      throw new Error('TOMORROW_API_KEY is required in .env file');
    }
    this.apiKey = apiKey;
  }

  definition: ToolFunction = {
    name: 'get_weather',
    description: 'Get the current weather forecast for a specific city',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'The city to get weather for',
        },
      },
      required: ['city'],
    },
  };

  async execute(args: { city: string }): Promise<any> {
    try {
      const encodedCity = encodeURIComponent(args.city);
      const url = `https://api.tomorrow.io/v4/weather/forecast?location=${encodedCity}&apikey=${this.apiKey}`;

      console.log('Making request to:', url.replace(this.apiKey, '[HIDDEN]'));

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'accept-encoding': 'deflate, gzip, br',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Weather API responded with status: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      // Extract relevant weather information from the response
      const currentWeather = data.timelines.minutely[0].values;

      return {
        city: args.city,
        temperature: Math.round(currentWeather.temperature),
        condition: this.getWeatherCondition(currentWeather.weatherCode),
        humidity: Math.round(currentWeather.humidity),
        windSpeed: Math.round(currentWeather.windSpeed),
      };
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw new Error('Failed to fetch weather data');
    }
  }

  private getWeatherCondition(weatherCode: number): string {
    // Tomorrow.io weather codes mapping to simple conditions
    // Reference: https://docs.tomorrow.io/reference/data-layers-weather-codes
    const weatherCodes: Record<number, string> = {
      1000: 'clear',
      1100: 'mostly_clear',
      1101: 'partly_cloudy',
      1102: 'mostly_cloudy',
      1001: 'cloudy',
      4000: 'rainy',
      4001: 'light_rain',
      4200: 'heavy_rain',
      5000: 'snow',
      5001: 'flurries',
      5100: 'light_snow',
      5101: 'heavy_snow',
      6000: 'freezing_rain',
      6200: 'light_freezing_rain',
      6001: 'heavy_freezing_rain',
      7000: 'sleet',
      7101: 'heavy_sleet',
      7102: 'light_sleet',
      8000: 'thunderstorm',
    };

    return weatherCodes[weatherCode] || 'unknown';
  }
}
