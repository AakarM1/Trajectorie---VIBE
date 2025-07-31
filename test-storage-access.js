// Firebase Storage URL Validator
console.log('🔍 Testing Firebase Storage URL accessibility...\n');

// Test function to validate Storage URLs
async function testStorageURL(url) {
  console.log(`🧪 Testing URL: ${url.substring(0, 80)}...`);
  
  try {
    // Test with different fetch configurations
    const configs = [
      { name: 'Default', options: {} },
      { name: 'CORS Mode', options: { mode: 'cors' } },
      { name: 'No-CORS Mode', options: { mode: 'no-cors' } },
      { name: 'Same-Origin Mode', options: { mode: 'same-origin' } },
      { name: 'With Headers', options: { 
        mode: 'cors',
        headers: { 'Accept': '*/*' }
      }}
    ];
    
    for (const config of configs) {
      try {
        console.log(`  📋 Testing ${config.name}...`);
        const response = await fetch(url, config.options);
        console.log(`    ✅ ${config.name}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const blob = await response.blob();
          console.log(`    📊 Size: ${blob.size} bytes, Type: ${blob.type}`);
          return { success: true, config: config.name, size: blob.size };
        }
      } catch (error) {
        console.log(`    ❌ ${config.name}: ${error.message}`);
      }
    }
    
    return { success: false };
  } catch (error) {
    console.log(`❌ All fetch attempts failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Test with a sample Firebase Storage URL format
const sampleStorageUrl = 'https://firebasestorage.googleapis.com/v0/b/trajectorie-vibe-8366c.firebasestorage.app/o/verification%2Ftest.txt?alt=media&token=ad9ce3d4-a494-4de6-8f32-5ebbae5ca7d9';

testStorageURL(sampleStorageUrl).then(result => {
  console.log('\n🎯 Test Result:', result);
  
  if (result.success) {
    console.log('✅ Firebase Storage URLs are accessible!');
    console.log('💡 The download issue might be something else.');
  } else {
    console.log('❌ Firebase Storage URLs are not accessible from browser.');
    console.log('🔧 This explains the download failures.');
  }
});
