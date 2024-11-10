import sqlite3 from 'sqlite3';

export function executeSQL(sql: string, dbPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    const startTime = Date.now();
    db.run(sql, (err) => {
      if (err) return reject(err);
      resolve((Date.now() - startTime) / 1000); // exec time in seconds
    });
    db.close();
  });
}

export async function getSqlRes(sql: string, dbPath: string): Promise<unknown[]> {
  const db = new sqlite3.Database(dbPath);
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
}