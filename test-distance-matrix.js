// Test script for Google Distance Matrix API
require('dotenv').config();
const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function testDistanceMatrix() {
  console.log('Testing Google Distance Matrix API...\n');

  if (!GOOGLE_MAPS_API_KEY) {
    console.error('❌ ERROR: GOOGLE_MAPS_API_KEY not found in .env file');
    process.exit(1);
  }

  console.log('✓ API Key found:', GOOGLE_MAPS_API_KEY.substring(0, 10) + '...');

  // Test with sample locations in Nigeria (Lagos to Ikeja)
  const origin = 'Lagos Island, Lagos, Nigeria';
  const destination = 'Ikeja, Lagos, Nigeria';

  console.log(`\nTesting route:`);
  console.log(`  Origin: ${origin}`);
  console.log(`  Destination: ${destination}\n`);

  try {
    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = {
      origins: origin,
      destinations: destination,
      key: GOOGLE_MAPS_API_KEY,
      units: 'metric'
    };

    console.log('Making API request...\n');

    const response = await axios.get(url, { params });
    const data = response.data;

    console.log('API Response Status:', data.status);
    console.log('Full Response:', JSON.stringify(data, null, 2));

    if (data.status === 'OK') {
      const element = data.rows[0].elements[0];

      if (element.status === 'OK') {
        console.log('\n✅ SUCCESS! Distance Matrix API is working!\n');
        console.log('Results:');
        console.log('  Distance:', element.distance.text);
        console.log('  Duration:', element.duration.text);
        console.log('  Distance (meters):', element.distance.value);
        console.log('  Duration (seconds):', element.duration.value);
      } else {
        console.log('\n⚠️  API responded but route calculation failed');
        console.log('Element status:', element.status);
      }
    } else if (data.status === 'REQUEST_DENIED') {
      console.log('\n❌ REQUEST DENIED!');
      console.log('Error message:', data.error_message);
      console.log('\nPossible causes:');
      console.log('  - API key is invalid');
      console.log('  - Distance Matrix API is not enabled for this key');
      console.log('  - Billing is not set up on Google Cloud Console');
      console.log('  - API key restrictions are blocking the request');
    } else {
      console.log('\n❌ API Error');
      console.log('Status:', data.status);
      console.log('Error message:', data.error_message || 'No error message');
    }

  } catch (error) {
    console.log('\n❌ Request failed');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testDistanceMatrix();
