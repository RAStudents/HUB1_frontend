import type { Role } from '../api/types';

export const useRole = (datasetRole?: Role) => ({
  isOwner: datasetRole === 'owner',
  isLabeler: datasetRole === 'labeler',
  isObserver: datasetRole === 'observer',
  canEdit: datasetRole === 'owner' || datasetRole === 'labeler',
  canInvite: datasetRole === 'owner',
  canExport: datasetRole === 'owner',
  canDelete: datasetRole === 'owner',
  canReview: datasetRole === 'owner',
});