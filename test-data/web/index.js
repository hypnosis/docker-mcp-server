// Simple test web application
console.log('Test web application started');
console.log('Environment:', process.env.NODE_ENV);
console.log('Database URL:', process.env.DATABASE_URL ? 'configured' : 'not configured');
console.log('Redis URL:', process.env.REDIS_URL ? 'configured' : 'not configured');

// Keep the process running
setInterval(() => {
  console.log('Web app is running...');
}, 60000);
