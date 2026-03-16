import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui';

interface EmployeeProfile {
  id: number;
  name: string;
  surname: string;
  role: string;
  department: string | null;
  storeName: string | null;
}

export interface EmployeeHomeData {
  profile: EmployeeProfile;
}

interface EmployeeHomeProps {
  data: EmployeeHomeData;
}

const infoRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
  fontSize: '14px',
};

const infoLabelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontWeight: 500,
};

const infoValueStyle: React.CSSProperties = {
  color: 'var(--text-primary)',
  fontWeight: 600,
};

const placeholderStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '32px 16px',
  color: 'var(--text-muted)',
  fontSize: '14px',
  fontStyle: 'italic',
};

export const EmployeeHome: React.FC<EmployeeHomeProps> = ({ data }) => {
  const { profile } = data;
  const { t } = useTranslation();

  const tRole = (role: string) => (t as (k: string) => string)(`roles.${role}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card title={t('home.employee.profileCard')}>
        <div>
          <div style={{ ...infoRowStyle, borderTop: '1px solid var(--border)' }}>
            <span style={infoLabelStyle}>{t('home.employee.firstName')}</span>
            <span style={infoValueStyle}>{profile.name}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>{t('home.employee.lastName')}</span>
            <span style={infoValueStyle}>{profile.surname}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>{t('home.employee.role')}</span>
            <span style={infoValueStyle}>{tRole(profile.role) ?? profile.role}</span>
          </div>
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>{t('home.employee.department')}</span>
            <span style={infoValueStyle}>{profile.department ?? '—'}</span>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <span style={infoLabelStyle}>{t('home.employee.store')}</span>
            <span style={infoValueStyle}>{profile.storeName ?? '—'}</span>
          </div>
        </div>
      </Card>

      <Card title={t('home.employee.nextShift')}>
        <div style={placeholderStyle}>{t('common.phase2')}</div>
      </Card>

      <Card title={t('home.employee.leaveBalance')}>
        <div style={placeholderStyle}>{t('common.phase2')}</div>
      </Card>
    </div>
  );
};

export default EmployeeHome;
