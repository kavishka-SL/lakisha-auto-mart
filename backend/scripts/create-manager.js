const db = require('../db').promise();
const { hashPassword } = require('../passwords');

async function main() {
  const username = process.env.SETUP_MANAGER_USERNAME?.trim();
  const name = process.env.SETUP_MANAGER_NAME?.trim();
  const password = process.env.SETUP_MANAGER_PASSWORD;

  if (!username || !name || !password || password.length < 12) {
    throw new Error('Set SETUP_MANAGER_USERNAME, SETUP_MANAGER_NAME, and a SETUP_MANAGER_PASSWORD of at least 12 characters.');
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[{ count }]] = await connection.query('SELECT COUNT(*) AS count FROM user');
    if (count !== 0) throw new Error('This command is only for a fresh, empty database. Existing accounts were not changed.');

    const passwordHash = await hashPassword(password);
    await connection.query(
      "INSERT INTO user (userId, username, passwordHash, name, role) VALUES ('U001', ?, ?, ?, 'MANAGER')",
      [username, passwordHash, name]
    );
    await connection.query("INSERT INTO manager (managerId, managerRoleType) VALUES ('U001', 'MANAGER')");
    await connection.commit();
    console.log('Manager account created. Sign in with the username and password you entered.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
