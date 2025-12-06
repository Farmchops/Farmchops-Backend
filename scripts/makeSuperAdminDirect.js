const mongoose = require('mongoose');

// Direct connection string - replace with your actual password
const MONGODB_URI = 'mongodb+srv://farmchops1:WURWmiWwu2ozmi2J@farmchops1.cl7qwl1.mongodb.net/?appName=farmchops1';

const UserSchema = new mongoose.Schema({
  email: String,
  firstName: String,
  lastName: String,
  role: String,
  adminRole: String,
  isActive: Boolean
}, { collection: 'users' });

const User = mongoose.model('User', UserSchema);

async function makeSuperAdmin(email) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!\n');

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`User with email "${email}" not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Current role: ${user.role}`);
    console.log(`Current admin role: ${user.adminRole || 'none'}`);

    user.role = 'admin';
    user.adminRole = 'super_admin';
    user.isActive = true;

    await user.save();

    console.log('\n✓ User successfully updated to Super Admin!');
    console.log(`New role: ${user.role}`);
    console.log(`New admin role: ${user.adminRole}`);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Please provide an email address');
  console.log('Usage: node scripts/makeSuperAdminDirect.js <email>');
  process.exit(1);
}

makeSuperAdmin(email);
