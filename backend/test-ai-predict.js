/**
 * AI Prediction Test Script
 * Run after backend starts: node test-ai-predict.js
 */

const axios = require('axios');

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function testAI() {
  console.log('🧪 Testing AI Prediction API...\n');

  try {
    // 1. Get active markets
    console.log('1. Fetching active markets...');
    const marketsRes = await axios.get(`${BASE_URL}/api/markets`);
    console.log(`   Found ${marketsRes.data.length} active markets\n`);

    if (marketsRes.data.length === 0) {
      console.log('❌ No active markets. Create a market first at /api/markets');
      return;
    }

    const marketId = marketsRes.data[0].id;
    console.log(`   Testing with market: ${marketsRes.data[0].question}`);
    console.log(`   Market ID: ${marketId}\n`);

    // 2. Test single prediction
    console.log('2. Testing POST /api/ai/predict');
    try {
      const predictRes = await axios.post(`${BASE_URL}/api/ai/predict`, {
        market_id: marketId
      });
      console.log('   ✅ Success!');
      console.log('   Direction:', predictRes.data.direction);
      console.log('   Confidence:', (predictRes.data.confidence * 100).toFixed(1) + '%');
      console.log('   Reasoning:', predictRes.data.reasoning);
      console.log('   Model:', predictRes.data.model);
      console.log('');
    } catch (err) {
      console.log('   ⚠️  API call failed:', err.response?.data?.error || err.message);
      console.log('   This is expected if OPENAI_API_KEY or ANTHROPIC_API_KEY is not set.\n');
    }

    // 3. Get existing prediction
    console.log('3. Testing GET /api/ai/prediction/:market_id');
    try {
      const getRes = await axios.get(`${BASE_URL}/api/ai/prediction/${marketId}`);
      console.log('   ✅ Found prediction');
      console.log('   Direction:', getRes.data.direction);
      console.log('   Confidence:', (getRes.data.confidence * 100).toFixed(1) + '%');
      console.log('');
    } catch (err) {
      if (err.response?.status === 404) {
        console.log('   ℹ️  No prediction exists yet for this market\n');
      } else {
        console.log('   ❌ Error:', err.message);
      }
    }

    // 4. Test batch predict
    console.log('4. Testing POST /api/ai/batch-predict');
    try {
      const batchRes = await axios.post(`${BASE_URL}/api/ai/batch-predict`);
      console.log('   ✅ Batch predict complete');
      console.log('   Total markets:', batchRes.data.total_markets);
      console.log('   Successful:', batchRes.data.successful);
      console.log('   Skipped:', batchRes.data.skipped);
      console.log('');
    } catch (err) {
      console.log('   ❌ Error:', err.response?.data?.error || err.message);
    }

    console.log('✅ AI Prediction API test complete!');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testAI();