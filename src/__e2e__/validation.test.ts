import { RepositoryFactory, Repository } from '../fixtures/repository';
import { isChangeFileNeeded } from '../validation/isChangeFileNeeded';
import { BeachballOptions } from '../types/BeachballOptions';
import { writeChangeFiles } from '../changefile/writeChangeFiles';
import { areChangeFilesDeleted } from '../validation/areChangeFilesDeleted';
import { getChangePath } from '../paths';
import fs from 'fs-extra';

describe('validation', () => {
  let repositoryFactory: RepositoryFactory;
  beforeAll(async () => {
    repositoryFactory = new RepositoryFactory();
    await repositoryFactory.create();
  });

  afterAll(async () => {
    await repositoryFactory.cleanUp();
  });

  describe('isChangeFileNeeded', () => {
    let repository: Repository;

    beforeEach(async () => {
      repository = await repositoryFactory.cloneRepository();
    });

    it('is false when no changes have been made', async () => {
      const result = isChangeFileNeeded({
        branch: 'origin/master',
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions);
      expect(result).toBeFalsy();
    });

    it('is true when changes exist in a new branch', async () => {
      await repository.branch('feature-0');
      await repository.commitChange('myFilename');
      const result = isChangeFileNeeded({
        branch: 'origin/master',
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions);
      expect(result).toBeTruthy();
    });

    it('is false when changes are CHANGELOG files', async () => {
      await repository.branch('feature-0');
      await repository.commitChange('CHANGELOG.md');
      const result = isChangeFileNeeded({
        branch: 'origin/master',
        path: repository.rootPath,
        fetch: false,
      } as BeachballOptions);
      expect(result).toBeFalsy();
    });

    it('throws if the remote is invalid', async () => {
      await repository.setRemoteUrl('origin', 'file:///__nonexistent');
      await repository.branch('feature-0');
      await repository.commitChange('CHANGELOG.md');

      expect(() => {
        isChangeFileNeeded({
          branch: 'origin/master',
          path: repository.rootPath,
          fetch: true,
        } as BeachballOptions);
      }).toThrow();
    });
  });

  describe('areChangeFilesDeleted', () => {
    let repository: Repository;

    beforeEach(async () => {
      repository = await repositoryFactory.cloneRepository();

      writeChangeFiles(
        {
          'pkg-1': {
            type: 'minor',
            comment: 'test',
            email: 'test@test.com',
            packageName: 'pkg-1',
            dependentChangeType: 'patch',
          },
        },
        repository.rootPath
      );

      await repository.push('origin', 'master');
    });

    it('is false when no change files are deleted', async () => {
      await repository.branch('feature-0');

      const result = areChangeFilesDeleted({
        branch: 'origin/master',
        path: repository.rootPath,
      } as BeachballOptions);
      expect(result).toBeFalsy();
    });

    it('is true when change files are deleted', async () => {
      await repository.branch('feature-0');

      const changeDirPath = getChangePath(repository.rootPath) ?? fail('No change folder found');
      fs.removeSync(changeDirPath);

      await repository.commitAll();

      const result = areChangeFilesDeleted({
        branch: 'origin/master',
        path: repository.rootPath,
      } as BeachballOptions);
      expect(result).toBeTruthy();
    });
  });
});
