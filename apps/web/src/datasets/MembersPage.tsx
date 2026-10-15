// apps/web/src/datasets/MembersPage.tsx
import { useState, FormEvent, useEffect } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth, useRole } from '../router';
import { apiClient } from '../api/client';
import { Member, Role } from '../api/types';

export const MembersPage = () => {
  const { id: datasetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [members, setMembers] = useState<Member[]>([]);
  const [datasetRole, setDatasetRole] = useState<Role | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('labeler');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [datasetId]);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      // TODO: заменить на реальный эндпоинт
      // const res = await apiClient.get<{ role: Role; members: Member[] }>(
      //   `/datasets/${datasetId}/members`
      // );
      // setDatasetRole(res.data.role);
      // setMembers(res.data.members);

      // Заглушка — текущий пользователь как владелец
      setDatasetRole('owner');
      setMembers(
        user
          ? [
              {
                id: '1',
                user: {
                  id: user.id,
                  email: user.email,
                  display_name: user.display_name,
                },
                role: 'owner',
                joined_at: new Date().toISOString(),
              },
            ]
          : []
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка загрузки участников');
    } finally {
      setIsLoading(false);
    }
  };

  const { isOwner } = useRole(datasetRole);

  // Если не владелец — редирект на главную (права проверяются и на API)
  if (datasetRole && !isOwner) {
    return <Navigate to="/" replace />;
  }

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.post(`/datasets/${datasetId}/members`, { email, role });
      // setSuccess(`Приглашение отправлено на ${email}`);
      // setEmail('');
      // loadMembers();

      alert(`Приглашение отправлено: ${email} (${role}) — заглушка`);
      setEmail('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка приглашения');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.patch(`/datasets/${datasetId}/members/${memberId}`, { role: newRole });
      // loadMembers();

      alert(`Роль изменена на ${newRole} — заглушка`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка смены роли');
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Удалить участника из датасета?')) return;

    try {
      // TODO: заменить на реальный эндпоинт
      // await apiClient.delete(`/datasets/${datasetId}/members/${memberId}`);
      // loadMembers();

      alert('Участник удалён — заглушка');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const roleLabels: Record<Role, string> = {
    owner: 'Владелец',
    labeler: 'Разметчик',
    observer: 'Наблюдатель',
  };

  const roleDescriptions: Record<Role, string> = {
    owner: 'Полный доступ: управление, экспорт, удаление',
    labeler: 'Разметка и отправка на проверку',
    observer: 'Только просмотр',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/" className="text-blue-600 hover:underline text-sm">
          ← Назад к списку
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mt-2">
          Участники датасета
        </h1>
        <p className="text-gray-500 mt-1">Управление доступом и приглашения</p>
      </div>

      <div className="space-y-6">
        {/* Форма приглашения */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Пригласить участника
          </h2>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 text-green-700 p-3 rounded mb-4 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleInvite} className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="labeler">Разметчик</option>
              <option value="observer">Наблюдатель</option>
            </select>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              Пригласить
            </button>
          </form>
        </div>

        {/* Список участников */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Текущие участники
          </h2>

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Загрузка...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Пока нет участников. Пригласите первого по email.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-md"
                >
                  <div>
                    <div className="font-medium text-gray-800">
                      {member.user.display_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      {member.user.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as Role)
                      }
                      disabled={member.role === 'owner'}
                      className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:bg-gray-100"
                    >
                      <option value="owner">Владелец</option>
                      <option value="labeler">Разметчик</option>
                      <option value="observer">Наблюдатель</option>
                    </select>
                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemove(member.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Справка по ролям */}
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-3">Роли и права</h3>
          <div className="space-y-2 text-sm">
            {Object.entries(roleLabels).map(([key, label]) => (
              <div key={key} className="flex gap-2">
                <span className="font-medium text-gray-700 w-32">{label}:</span>
                <span className="text-gray-600">
                  {roleDescriptions[key as Role]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};