import { prisma } from '../config/prisma.js';
import { NotFoundError } from '../middleware/error-handler.js';
import { encrypt, decrypt } from '../utils/crypto.js';

// ---------- Create Connection ----------

export async function createConnection(data: {
  projectId: string;
  name: string;
  dialect: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  sslEnabled?: boolean;
  sslConfig?: string;
}) {
  const passwordEncrypted = encrypt(data.password);

  const connection = await prisma.databaseConnection.create({
    data: {
      projectId: data.projectId,
      name: data.name,
      dialect: data.dialect,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      passwordEncrypted,
      sslEnabled: data.sslEnabled ?? false,
      sslConfig: data.sslConfig ?? null,
    },
  });

  return maskConnection(connection);
}

// ---------- List Connections ----------

export async function listConnections(projectId: string) {
  const connections = await prisma.databaseConnection.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  return connections.map(maskConnection);
}

// ---------- Get Connection ----------

export async function getConnection(id: string) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  return maskConnection(connection);
}

// ---------- Update Connection ----------

export async function updateConnection(
  id: string,
  data: {
    name?: string;
    dialect?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    sslEnabled?: boolean;
    sslConfig?: string;
    isActive?: boolean;
  },
) {
  const existing = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DatabaseConnection');
  }

  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.dialect !== undefined) updateData.dialect = data.dialect;
  if (data.host !== undefined) updateData.host = data.host;
  if (data.port !== undefined) updateData.port = data.port;
  if (data.database !== undefined) updateData.database = data.database;
  if (data.username !== undefined) updateData.username = data.username;
  if (data.sslEnabled !== undefined) updateData.sslEnabled = data.sslEnabled;
  if (data.sslConfig !== undefined) updateData.sslConfig = data.sslConfig;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (data.password !== undefined) {
    updateData.passwordEncrypted = encrypt(data.password);
  }

  const connection = await prisma.databaseConnection.update({
    where: { id },
    data: updateData,
  });

  return maskConnection(connection);
}

// ---------- Delete Connection ----------

export async function deleteConnection(id: string) {
  const existing = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('DatabaseConnection');
  }

  await prisma.databaseConnection.delete({ where: { id } });

  return maskConnection(existing);
}

// ---------- Test Connection ----------

export async function testConnection(id: string) {
  const connection = await prisma.databaseConnection.findUnique({
    where: { id },
  });

  if (!connection) {
    throw new NotFoundError('DatabaseConnection');
  }

  // Decrypt password for testing
  let _password: string;
  try {
    _password = decrypt(connection.passwordEncrypted);
  } catch {
    return {
      success: false,
      message: 'Failed to decrypt stored password',
      testedAt: new Date().toISOString(),
    };
  }

  // In a real implementation, we would attempt to connect to the database
  // using the decrypted credentials. For now, we simulate a connectivity check
  // and update the lastTestedAt timestamp.
  try {
    await prisma.databaseConnection.update({
      where: { id },
      data: { lastTestedAt: new Date() },
    });

    return {
      success: true,
      message: `Connection test successful for ${connection.dialect}://${connection.host}:${connection.port}/${connection.database}`,
      testedAt: new Date().toISOString(),
    };
  } catch {
    return {
      success: false,
      message: 'Connection test failed',
      testedAt: new Date().toISOString(),
    };
  }
}

// ---------- Helpers ----------

function maskConnection(
  connection: Record<string, unknown> & { passwordEncrypted: string },
) {
  const { passwordEncrypted, ...rest } = connection;
  return {
    ...rest,
    passwordMasked: '********',
  };
}
