'use client';

import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  MenuProps,
  Modal,
  Popconfirm,
  Select,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Ban, CheckCircle, MoreVertical, Trash2, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { lambdaQuery as trpc } from '@/libs/trpc/client';

const { Title, Text } = Typography;

const AdminPage = () => {
  const { data: users, refetch: refetchUsers } = trpc.admin.listUsers.useQuery({
    page: 1,
    pageSize: 100,
  });
  const { data: stats, refetch: refetchStats } = trpc.admin.getDashboardStats.useQuery();
  const { data: invites, refetch: refetchInvites } = trpc.admin.getInvites.useQuery();

  const [formInvite] = Form.useForm();
  const updateUserQuota = trpc.admin.updateUserQuota.useMutation({
    onSuccess: () => refetchUsers(),
  });
  const updateUserRole = trpc.admin.updateUserRole.useMutation({ onSuccess: () => refetchUsers() });
  const toggleUserBlock = trpc.admin.toggleUserBlock.useMutation({
    onSuccess: () => refetchUsers(),
  });
  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      refetchUsers();
      refetchStats();
    },
  });
  const toggleSignup = trpc.admin.toggleSignup.useMutation({ onSuccess: () => refetchStats() });
  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: () => {
      refetchInvites();
      formInvite.resetFields();
    },
  });
  const revokeInvite = trpc.admin.revokeInvite.useMutation({ onSuccess: () => refetchInvites() });

  const [editingUser, setEditingUser] = useState<any>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [form] = Form.useForm();

  const handleEdit = (record: any) => {
    setEditingUser(record);
    form.setFieldsValue({
      role: record.role || 'user',
      tokenQuota: record.tokenQuota,
    });
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingUser) {
      if (values.tokenQuota !== editingUser.tokenQuota) {
        await updateUserQuota.mutateAsync({
          tokenQuota: values.tokenQuota,
          userId: editingUser.id,
        });
      }
      if (values.role !== editingUser.role) {
        await updateUserRole.mutateAsync({ role: values.role, userId: editingUser.id });
      }
      setEditingUser(null);
    }
  };

  const handleCreateInvite = async () => {
    const values = await formInvite.validateFields();
    const result = await createInvite.mutateAsync(values);
    setCreatedToken(result.token);
  };

  const menuProps = (record: any): MenuProps => ({
    items: [
      {
        icon: <UserCog size={16} />,
        key: 'edit',
        label: 'Edit Role/Quota',
        onClick: () => handleEdit(record),
      },
      {
        danger: !record.isBlocked,
        icon: record.isBlocked ? <CheckCircle size={16} /> : <Ban size={16} />,
        key: 'block',
        label: record.isBlocked ? 'Unblock User' : 'Block User',
        onClick: async () => {
          await toggleUserBlock.mutateAsync({ isBlocked: !record.isBlocked, userId: record.id });
        },
      },
      {
        type: 'divider',
      },
      {
        icon: <Trash2 color="red" size={16} />,
        key: 'delete',
        label: (
          <Popconfirm
            cancelText="No"
            description="Are you sure? This action cannot be undone."
            okText="Yes"
            onConfirm={async () => await deleteUser.mutateAsync({ userId: record.id })}
            title="Delete User"
          >
            <span style={{ color: 'red' }}>Delete User</span>
          </Popconfirm>
        ),
      },
    ],
  });

  const columns = [
    { dataIndex: 'id', ellipsis: true, key: 'id', title: 'ID', width: 100 },
    { dataIndex: 'email', ellipsis: true, key: 'email', title: 'Email' },
    { dataIndex: 'username', ellipsis: true, key: 'username', title: 'Username' },
    {
      dataIndex: 'isBlocked',
      key: 'isBlocked',
      render: (isBlocked: boolean) =>
        isBlocked ? (
          <Tag color="error" icon={<Ban size={12} />}>
            Blocked
          </Tag>
        ) : (
          <Tag color="success">Active</Tag>
        ),
      title: 'Status',
      width: 100,
    },
    {
      dataIndex: 'role',
      key: 'role',
      render: (text: string) => (
        <Tag color={text === 'admin' ? 'purple' : 'blue'}>{text || 'user'}</Tag>
      ),
      title: 'Role',
      width: 100,
    },
    {
      key: 'usage',
      render: (_: any, record: any) => {
        const used = record.currentMonthTokens || 0;
        const quota = record.tokenQuota;
        const quotaText = quota ? quota.toLocaleString() : '∞';

        const isOverLimit = quota && used >= quota;
        const isNearLimit = quota && used >= quota * 0.9;
        const color = isOverLimit ? '#ff4d4f' : isNearLimit ? '#faad14' : undefined;

        return (
          <span style={{ color }}>
            {used.toLocaleString()} / {quotaText}
          </span>
        );
      },
      title: 'Usage / Quota',
      width: 150,
    },
    {
      key: 'action',
      render: (_: any, record: any) => (
        <Dropdown menu={menuProps(record)} trigger={['click']}>
          <Button icon={<MoreVertical size={16} />} type="text" />
        </Dropdown>
      ),
      title: 'Action',
      width: 80,
    },
  ];

  const inviteColumns = [
    { dataIndex: 'email', ellipsis: true, key: 'email', title: 'Email' },
    {
      dataIndex: 'role',
      key: 'role',
      render: (text: string) => <Tag color={text === 'admin' ? 'purple' : 'blue'}>{text}</Tag>,
      title: 'Role',
    },
    {
      dataIndex: 'tokenQuota',
      key: 'tokenQuota',
      render: (val: number) => (val ? val.toLocaleString() : 'Unlimited'),
      title: 'Quota',
    },
    {
      key: 'token',
      render: (_: any, record: any) => (
        <Typography.Paragraph
          copyable={{ text: `${window.location.origin}/invite/${record.token}` }}
          style={{ marginBottom: 0 }}
        >
          {record.token.slice(0, 8)}...
        </Typography.Paragraph>
      ),
      title: 'Link',
    },
    {
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (val: string) => new Date(val).toLocaleDateString(),
      title: 'Expires',
    },
    {
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm onConfirm={() => revokeInvite.mutate({ id: record.id })} title="Revoke Invite?">
          <Button danger icon={<Trash2 size={16} />} type="text" />
        </Popconfirm>
      ),
      title: 'Action',
    },
  ];

  return (
    <Flexbox gap={24} padding={24} style={{ height: '100%', overflow: 'auto', width: '100%' }}>
      <Flexbox align={'center'} horizontal justify={'space-between'}>
        <Title level={2} style={{ margin: 0 }}>
          Admin Dashboard
        </Title>
        <Flexbox align={'center'} gap={12} horizontal>
          <Button onClick={() => setInviteModalOpen(true)} type="primary">
            Invite User
          </Button>
          <Flexbox
            align={'center'}
            gap={8}
            horizontal
            style={{ borderLeft: '1px solid #ddd', paddingLeft: 12 }}
          >
            <Text strong>Enable Signups</Text>
            <Switch
              checked={stats?.enableSignup}
              loading={toggleSignup.isPending}
              onChange={(checked) => toggleSignup.mutate({ enable: checked })}
            />
          </Flexbox>
        </Flexbox>
      </Flexbox>

      {/* KPI Cards ... */}
      <Flexbox gap={16} horizontal style={{ width: '100%' }}>
        <Card style={{ flex: 1 }}>
          <Statistic loading={!stats} title="Total Users" value={stats?.totalUsers || 0} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic loading={!stats} title="Total Messages" value={stats?.totalMessages || 0} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic
            loading={!stats}
            title="System Status"
            value={stats?.enableSignup ? 'Open' : 'Closed'}
            valueStyle={{ color: stats?.enableSignup ? '#3f8600' : '#cf1322' }}
          />
        </Card>
      </Flexbox>

      <Flexbox gap={16}>
        <Card title="Pending Invites" variant="borderless">
          <Table
            columns={inviteColumns}
            dataSource={invites || []}
            pagination={false}
            rowKey="id"
            size="small"
          />
        </Card>

        <Card title="User Management" variant="borderless">
          <Table
            columns={columns}
            dataSource={users || []}
            pagination={{ pageSize: 10 }}
            rowKey="id"
          />
        </Card>
      </Flexbox>

      {/* Edit Modal ... */}
      <Modal
        onCancel={() => setEditingUser(null)}
        onOk={handleSave}
        open={!!editingUser}
        title="Edit User"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="Role" name="role">
            <Select>
              <Select.Option value="user">User</Select.Option>
              <Select.Option value="admin">Admin</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="Monthly Token Quota (0 or empty for unlimited)" name="tokenQuota">
            <InputNumber
              formatter={(value) => `${value}`.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ',')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Invite Modal */}
      <Modal
        footer={null}
        onCancel={() => {
          setInviteModalOpen(false);
          setCreatedToken(null);
          formInvite.resetFields();
        }}
        open={inviteModalOpen}
        title="Invite New User"
      >
        {!createdToken ? (
          <Form form={formInvite} layout="vertical" onFinish={handleCreateInvite}>
            <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="user@example.com" />
            </Form.Item>
            <Form.Item initialValue="user" label="Role" name="role">
              <Select>
                <Select.Option value="user">User</Select.Option>
                <Select.Option value="admin">Admin</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Quota (Optional)" name="tokenQuota">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Button block htmlType="submit" loading={createInvite.isPending} type="primary">
              Generate Invite Link
            </Button>
          </Form>
        ) : (
          <Flexbox align={'center'} gap={16}>
            <CheckCircle color="green" size={48} />
            <Title level={4}>Invite Created!</Title>
            <Text>Share this link with the user:</Text>
            <Typography.Paragraph
              copyable={{
                text: `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${createdToken}`,
              }}
              style={{ background: '#f5f5f5', borderRadius: 4, padding: 8, width: '100%' }}
            >
              {`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${createdToken}`}
            </Typography.Paragraph>
            <Button
              onClick={() => {
                setCreatedToken(null);
                formInvite.resetFields();
              }}
            >
              Create Another
            </Button>
          </Flexbox>
        )}
      </Modal>
    </Flexbox>
  );
};

export default AdminPage;
