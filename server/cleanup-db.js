// Script to clean up corrupted friends data
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rageadmin:rageadmin119330@rageme.wwx2e96.mongodb.net/?appName=rageme';

async function cleanup() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the problematic unique index if it exists
    try {
      await db.collection('friends').dropIndex('user_1_friend_1');
      console.log('Dropped index user_1_friend_1');
    } catch (e) {
      console.log('Index not found or already dropped');
    }
    
    // Delete ALL friends with null/missing values
    const result = await db.collection('friends').deleteMany({
      $or: [
        { user1: null },
        { user2: null },
        { user1: { $exists: false } },
        { user2: { $exists: false } }
      ]
    });
    
    console.log(`Deleted ${result.deletedCount} corrupted friend records`);
    
    // Also delete any duplicates (keep only the first one)
    const friends = await db.collection('friends').find({}).toArray();
    const seen = new Set();
    let duplicatesDeleted = 0;
    
    for (const friend of friends) {
      const key = [friend.user1, friend.user2].sort().join('-');
      if (seen.has(key)) {
        await db.collection('friends').deleteOne({ _id: friend._id });
        duplicatesDeleted++;
      } else {
        seen.add(key);
      }
    }
    
    console.log(`Deleted ${duplicatesDeleted} duplicate friend records`);
    console.log('Cleanup complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

cleanup();
