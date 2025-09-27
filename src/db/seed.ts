

// This script seeds the database with a test user
// Run with: npm run db:seed

async function seed() {

  try {
    // Create test user with a fixed ID
    const testUserId = "test-user-001";
    const testUserEmail = "test@example.com";

    // Note: In production, you'd connect to your actual D1 database
    // For now, let's create a migration file instead
    console.log("Creating test user with:");
    console.log("  ID:", testUserId);
    console.log("  Email:", testUserEmail);
    console.log("");
    console.log("Run the following SQL in your database:");
    console.log(`INSERT OR IGNORE INTO users (id, email) VALUES ('${testUserId}', '${testUserEmail}');`);

  } catch (error) {
    console.error("Seed error:", error);
    process.exit(1);
  }
}

// Export for use in other files
export const TEST_USER_ID = "test-user-001";
export const TEST_USER_EMAIL = "test@example.com";

if (require.main === module) {
  seed();
}