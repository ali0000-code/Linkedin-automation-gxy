/**
 * Sidebar Component
 *
 * Main navigation sidebar with logo and menu items.
 * Supports expandable sub-items for nested navigation.
 */

import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { useLogout } from '../../hooks/useAuth';
import { useInboxStats } from '../../hooks/useInbox';
import { useExtension } from '../../hooks/useExtension';
import Button from '../common/Button';

// Simple SVG Icons
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const CampaignIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>
);

const InboxIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

const MailIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PricingIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const Sidebar = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [expandedItems, setExpandedItems] = useState(['Campaign']); // Campaign expanded by default
  const { data: stats } = useInboxStats();
  const { isConnected, checkNewMessages } = useExtension();

  // Check for new messages from extension every 10 seconds
  useEffect(() => {
    if (!isConnected) return;

    const checkForNewMessages = async () => {
      try {
        const result = await checkNewMessages();
        if (result.hasNewMessages && result.count > 0) {
          // Refresh inbox stats to update the badge
          queryClient.invalidateQueries({ queryKey: ['inboxStats'] });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      } catch (e) {
        // Ignore errors
      }
    };

    // Check immediately
    checkForNewMessages();

    // Then poll every 10 seconds
    const pollInterval = setInterval(checkForNewMessages, 10000);

    return () => clearInterval(pollInterval);
  }, [isConnected, checkNewMessages, queryClient]);

  const unreadCount = stats?.unread_conversations || 0;

  const menuItems = [
    { name: 'Home', path: '/dashboard', icon: HomeIcon, comingSoon: true },
    { name: 'Prospects', path: '/prospects', icon: UsersIcon, comingSoon: false },
    {
      name: 'Campaign',
      icon: CampaignIcon,
      comingSoon: false,
      subItems: [
        { name: 'Campaigns List', path: '/campaign/list' },
        { name: 'Message Templates', path: '/campaign/templates' }
      ]
    },
    { name: 'Mail', path: '/mail', icon: MailIcon, comingSoon: false },
    { name: 'Inbox', path: '/inbox', icon: InboxIcon, comingSoon: false },
    { name: 'Pricing', path: '/pricing', icon: PricingIcon, comingSoon: true },
    { name: 'Settings', path: '/settings', icon: SettingsIcon, comingSoon: false },
  ];

  const toggleExpand = (itemName) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const isExpanded = (itemName) => expandedItems.includes(itemName);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white w-64 fixed left-0 top-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-linkedin rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="text-xl font-bold">LinkedIn Auto</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isItemExpanded = isExpanded(item.name);

          // Check if any sub-item is active
          const isSubItemActive = hasSubItems && item.subItems.some(sub => location.pathname === sub.path);
          const isParentActive = item.path && location.pathname === item.path;

          return (
            <div key={item.name}>
              {/* Main Menu Item */}
              {hasSubItems ? (
                <button
                  onClick={() => !item.comingSoon && toggleExpand(item.name)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isSubItemActive
                      ? 'bg-linkedin/20 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  } ${item.comingSoon ? 'cursor-not-allowed opacity-60' : ''}`}
                  disabled={item.comingSoon}
                >
                  <div className="flex items-center space-x-3">
                    <Icon />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.comingSoon && (
                      <span className="text-xs bg-gray-700 px-2 py-1 rounded">Soon</span>
                    )}
                    {!item.comingSoon && (
                      <div className="transition-transform">
                        {isItemExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                      </div>
                    )}
                  </div>
                </button>
              ) : (
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-linkedin text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    } ${item.comingSoon ? 'cursor-not-allowed opacity-60' : ''}`
                  }
                  onClick={(e) => {
                    if (item.comingSoon) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Icon />
                      {/* Unread badge for Inbox */}
                      {item.name === 'Inbox' && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {item.comingSoon && (
                    <span className="text-xs bg-gray-700 px-2 py-1 rounded">Soon</span>
                  )}
                  {/* Also show count next to Inbox text */}
                  {item.name === 'Inbox' && unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </NavLink>
              )}

              {/* Sub Items */}
              {hasSubItems && isItemExpanded && !item.comingSoon && (
                <div className="ml-4 mt-1 space-y-1">
                  {item.subItems.map((subItem) => (
                    <NavLink
                      key={subItem.path}
                      to={subItem.path}
                      className={({ isActive }) =>
                        `flex items-center px-4 py-2 rounded-lg transition-colors text-sm ${
                          isActive
                            ? 'bg-linkedin text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`
                      }
                    >
                      <span className="ml-6">{subItem.name}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User Profile Section */}
      <UserProfile />
    </div>
  );
};

/**
 * User Profile Component
 * Shows user info and logout button in sidebar
 */
const UserProfile = () => {
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  return (
    <div className="border-t border-gray-800 p-4">
      <div className="flex items-center space-x-3 mb-3">
        {user?.profile_image_url ? (
          <img
            src={user.profile_image_url}
            alt={user.name}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">{getInitials(user?.name)}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email || 'No email'}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleLogout}
        loading={logoutMutation.isPending}
        className="w-full"
      >
        Logout
      </Button>
    </div>
  );
};

export default Sidebar;
