export default {
  // ให้ ts-jest แปลง TypeScript แบบ ESM
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        isolatedModules: true,
        types: ['jest', 'node'],
      },
    }],
  },
  testEnvironment: 'node',
  // บอกให้ Jest ปฏิบัติกับ .ts เป็น ESM
  extensionsToTreatAsEsm: ['.ts'],
  // แก้ path import ที่ลงท้าย .js ในโค้ด TypeScript
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // แก้เคส lib ESM บางตัว
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
