import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in environment variables');
  process.exit(1);
}

const makeSuperAdmin = async (email: string) => {
  try {
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.error(`User with email "${email}" not found`);
      return false;
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Current role: ${user.role}`);
    console.log(`Current admin role: ${user.adminRole || 'none'}`);

    // Update user to super admin
    user.role = 'admin';
    user.adminRole = 'super_admin';
    user.permissions = ['*'];  // Grant all permissions
    user.isActive = true;

    await user.save();

    console.log('\n✓ User successfully updated to Super Admin!');
    console.log(`New role: ${user.role}`);
    console.log(`New admin role: ${user.adminRole}`);

    return true;
  } catch (error) {
    console.error('Error updating user:', error);
    return false;
  }
};

(async () => {
  // Get email from command line argument
  const email = process.argv[2];

  if (!email) {
    console.error('Please provide an email address');
    console.log('Usage: npm run make-super-admin <email>');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const success = await makeSuperAdmin(email);

  await mongoose.disconnect();
  console.log('\nDisconnected from MongoDB');

  process.exit(success ? 0 : 1);
})().catch(async (error) => {
  console.error('Script failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
