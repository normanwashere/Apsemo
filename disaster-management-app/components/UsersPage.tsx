import React from 'react';
import { GlassCard, Icon } from './ui';
import { useApp } from '../App';

const UsersPage: React.FC = () => {
    const { user } = useApp();

    if (user?.role !== 'admin') {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">Access Denied</h2>
                <GlassCard>
                    <div className="text-center py-10">
                         <Icon name="fa-lock" className="text-4xl text-red-500 mb-4" />
                        <p className="text-slate-700">You do not have permission to view this page.</p>
                    </div>
                </GlassCard>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-800 text-center sm:text-left">User Management</h2>
            <GlassCard>
                <div className="text-center py-10">
                    <Icon name="fa-tools" className="text-4xl text-slate-500 mb-4" />
                    <p className="text-slate-700">User management features are under development.</p>
                </div>
            </GlassCard>
        </div>
    );
};

export default UsersPage;