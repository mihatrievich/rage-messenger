// Script to set developer badge for a user
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rageadmin:rageadmin119330@rageme.wwx2e96.mongodb.net/?appName=rageme';

async function setDeveloper() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('./models/User');
    
    // Find the user - you can change the username here
    const username = process.argv[2] || 'Максим';
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log(`User "${username}" not found`);
      console.log('Available users:');
      const users = await User.find({}, 'username isDeveloper');
      users.forEach(u => console.log(`  - ${u.username} (isDeveloper: ${u.isDeveloper})`));
    } else {
      user.isDeveloper = true;
      await user.save();
      console.log(`Set isDeveloper=true for user: ${user.username}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

setDeveloper();
