import { UTCDate } from '@date-fns/utc';
import { addDays } from 'date-fns';
import { EntityManager } from 'typeorm';
import { SharableLink } from '../entities/sharable-link.entity';
import { generateUrlSafeToken } from './crypto.service';
import { AppDataSource } from '../data-source';

export enum SharableLinkStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  NOT_FOUND = 'not_found',
}
const sharableLinkRepository = AppDataSource.getRepository(SharableLink);

export const generateSharableFinancialStatementLink = async (
  manager: EntityManager,
  financialStatementId: number,
) => {
  const token = generateUrlSafeToken();
  // 7 days duration
  const now = new UTCDate();
  const expiresAt = addDays(now, 7);
  const sharableLink = await manager.getRepository(SharableLink).save({
    financialStatementId,
    token,
    expiresAt,
    createdAt: now,
  });
  return sharableLink.token;
};

export const findSharableLinkByToken = async (
  token: string,
): Promise<{
  status: SharableLinkStatus;
  record: SharableLink | null;
}> => {
  const sharableLink = await sharableLinkRepository.findOne({
    where: {
      token,
    },
  });
  if (!sharableLink) {
    return {
      status: SharableLinkStatus.NOT_FOUND,
      record: null,
    };
  }
  if (sharableLink.expiresAt < new UTCDate()) {
    return {
      status: SharableLinkStatus.EXPIRED,
      record: sharableLink,
    };
  }
  return {
    status: SharableLinkStatus.ACTIVE,
    record: sharableLink,
  };
};
