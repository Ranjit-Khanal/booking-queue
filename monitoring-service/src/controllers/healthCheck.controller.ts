import { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

 export const healthCheck = async (_req: Request, res: Response) => {
  const services = [
    { name: 'api-service', url: 'http://localhost:3000/health' },
    { name: 'queue-service', url: 'http://localhost:3001/health' },
    { name: 'stream-service', url: 'http://localhost:3002/health' },
    { name: 'kafka-service', url: 'http://localhost:3003/health' }
  ];

  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const response = await axios.get(service.url, { timeout: 2000 });
        console.log(`Health check for ${service.name} succeeded:`, response.data);
        return { ...service, status: 'healthy', data: response.data };
      } catch (error) {
        const err = error as AxiosError;
        return { ...service, status: 'unhealthy', error: err.message };
      }
    })
  );

  res.json({
    timestamp: new Date().toISOString(),
    services: healthChecks.map((result, index) => 
      result.status === 'fulfilled' ? result.value : { ...services[index], status: 'error' }
    )
  });
};