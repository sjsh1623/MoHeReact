import { createRoot } from 'react-dom/client'
import '@/styles/global.css'
import React from 'react';

const path = window.location.pathname;

// ── Standalone product pages — completely isolated ───────────────
if (path.startsWith('/goodbyetox')) {
    const root = createRoot(document.getElementById('root'));

    if (path === '/goodbyetox/ko') {
        import('@/pages/health/HealthKoPage.jsx').then(({ default: Page }) => {
            root.render(<Page />);
        });
    } else {
        import('@/pages/health/HealthEnPage.jsx').then(({ default: Page }) => {
            root.render(<Page />);
        });
    }

// ── Main app ─────────────────────────────────────────────────────
} else {
    Promise.all([
        import('@/i18n'),
        import('@/components/ui/transitions/AnimatedRoutes.jsx'),
        import('react-router-dom'),
        import('@/contexts'),
        import('@/contexts/BackButtonContext'),
        import('@/components/ui/layout/GlobalBackButtonWrapper'),
        import('@/components/ui/layout/GlobalFloatingButton'),
        import('@/components/ui/layout/GlobalMessageInput'),
        import('@/components/ui/layout'),
        import('@/utils/webviewOptimizations'),
        import('@/utils/versionCheck'),
        import('@/components/ErrorBoundary'),
    ]).then(([
        _i18n,
        { default: AnimatedRoutes },
        { BrowserRouter },
        { AuthProvider, UserPreferencesProvider },
        { BackButtonProvider },
        { default: GlobalBackButtonWrapper },
        { default: GlobalFloatingButton },
        { default: GlobalMessageInput },
        { AppShell },
        { initializeWebViewOptimizations },
        { initializeVersionCheck },
        { default: ErrorBoundary },
    ]) => {
        initializeWebViewOptimizations();
        initializeVersionCheck();

        createRoot(document.getElementById('root')).render(
            <ErrorBoundary>
                <BrowserRouter>
                    <AuthProvider>
                        <BackButtonProvider>
                            <UserPreferencesProvider>
                                <AppShell>
                                    <AnimatedRoutes />
                                </AppShell>
                                <GlobalBackButtonWrapper />
                                <GlobalFloatingButton />
                                <GlobalMessageInput />
                            </UserPreferencesProvider>
                        </BackButtonProvider>
                    </AuthProvider>
                </BrowserRouter>
            </ErrorBoundary>
        );
    });
}
