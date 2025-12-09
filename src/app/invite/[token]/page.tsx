'use client';

import { Button, Result, Spin, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { Flexbox } from 'react-layout-kit';

import { lambdaQuery as trpc } from '@/libs/trpc/client';

const InvitePage = ({ params }: { params: Promise<{ token: string }> }) => {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'unauthorized'>('loading');
  const [message, setMessage] = useState('Verifying invite...');

  const claimInvite = trpc.invite.claimInvite.useMutation();

  useEffect(() => {
    const verifyAndClaim = async () => {
      try {
        await claimInvite.mutateAsync({ token });
        setStatus('success');
        setMessage('Invite claimed successfully! Your account has been updated.');
      } catch (error: any) {
        console.error(error);
        if (error.data?.code === 'UNAUTHORIZED') {
          setStatus('unauthorized');
          setMessage('Please log in with the email address associated with this invite.');
        } else {
          setStatus('error');
          setMessage(error.message || 'Failed to claim invite.');
        }
      }
    };

    verifyAndClaim();
  }, [token]);

  const handleLogin = () => {
    // Redirect to login with callback back to this page
    router.push(`/api/auth/signin?callbackUrl=/invite/${token}`);
  };

  return (
    <Flexbox align={'center'} justify={'center'} style={{ height: '100vh', width: '100vw' }}>
      {status === 'loading' && (
        <Flexbox align="center" gap={16}>
          <Spin size="large" />
          <Typography.Text type="secondary">{message}</Typography.Text>
        </Flexbox>
      )}
      {status === 'success' && (
        <Result
          extra={[
            <Button key="console" onClick={() => router.push('/chat')} type="primary">
              Go to Chat
            </Button>,
          ]}
          status="success"
          subTitle={message}
          title="Account Activated!"
        />
      )}
      {status === 'unauthorized' && (
        <Result
          extra={[
            <Button key="login" onClick={handleLogin} type="primary">
              Log In / Sign Up
            </Button>,
            <Button key="home" onClick={() => router.push('/')}>
              Back Home
            </Button>,
          ]}
          status="info"
          subTitle={message}
          title="Login Required"
        />
      )}
      {status === 'error' && (
        <Result
          extra={[
            <Button key="home" onClick={() => router.push('/')}>
              Back Home
            </Button>,
          ]}
          status="error"
          subTitle={message}
          title="Activation Failed"
        />
      )}
    </Flexbox>
  );
};

export default InvitePage;
