import { BaseFunction, ToolFunction } from '../types.js';

export class WeatherFunction implements BaseFunction {
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
    // This is a mock implementation
    const mockWeather = {
      temperature: Math.round(15 + Math.random() * 10),
      condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
      humidity: Math.round(60 + Math.random() * 20),
    };

    return {
      city: args.city,
      ...mockWeather,
    };
  }
}
