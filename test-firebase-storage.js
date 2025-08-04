// Test Firebase Storage connection
const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadBytes, getDownloadURL, connectStorageEmulator } = require('firebase/storage');

// Use the same config as your app (from .env file)
const firebaseConfig = {
  apiKey: "AIzaSyDN7C4sqES4HdNzue82-OOsuzP6GbKEQ-A",
  authDomain: "trajectorie-vibe-8366c.firebaseapp.com",
  projectId: "trajectorie-vibe-8366c",
  storageBucket: "trajectorie-vibe-8366c.firebasestorage.app",
  messagingSenderId: "617194852227",
  appId: "1:617194852227:web:09eae4b037b5831eb170b6"
};

console.log('🔧 Firebase Config:', firebaseConfig);

// Test different storage bucket possibilities
const possibleBuckets = [
  "trajectorie-vibe-8366c.firebasestorage.app",
  "trajectorie-vibe-8366c.appspot.com",
  null // Use default
];

async function testStorageBucket(bucketName) {
  console.log(`\n🧪 Testing storage bucket: ${bucketName || 'default'}`);
  
  try {
    const app = initializeApp(firebaseConfig, `test-${Date.now()}`);
    const storage = bucketName ? getStorage(app, `gs://${bucketName}`) : getStorage(app);
    
    const testRef = ref(storage, 'test/diagnostic.txt');
    console.log(`✅ Storage ref created for bucket ${bucketName || 'default'}`);
    
    const testBlob = new Blob(['test'], { type: 'text/plain' });
    await uploadBytes(testRef, testBlob);
    console.log(`✅ Upload successful to ${bucketName || 'default'}`);
    
    return true;
  } catch (error) {
    console.log(`❌ Failed for ${bucketName || 'default'}:`, error.code, error.message);
    return false;
  }
}

async function runDiagnostics() {
  console.log('🔍 Running Firebase Storage diagnostics...\n');
  
  for (const bucket of possibleBuckets) {
    const success = await testStorageBucket(bucket);
    if (success) {
      console.log(`\n🎉 SUCCESS! Working bucket: ${bucket || 'default'}`);
      return;
    }
  }
  
  console.log('\n❌ No working storage buckets found');
  console.log('\n💡 This likely means:');
  console.log('   1. Firebase Storage is not enabled in Firebase Console');
  console.log('   2. Storage rules are too restrictive');
  console.log('   3. Project ID or bucket name is incorrect');
  console.log('\n🔧 To fix:');
  console.log('   1. Go to Firebase Console → Storage');
  console.log('   2. Click "Get started" to enable Storage');
  console.log('   3. Set up Storage rules');
}

// Run the test
runDiagnostics();
