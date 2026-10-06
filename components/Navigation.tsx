import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { hasPermission, Permission, UserRole } from '@/lib/security/rbac';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  LayoutDashboard,
  DollarSign, 
  Clock,
  Calculator,
  Settings,
  LogOut,
  Menu,
  X,
  BarChart3,
  User,
  Users,
  ChevronDown
} from 'lucide-react';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useLocalAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSettings = () => {
    navigate('/settings');
  };

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Tips',
      permission: Permission.TIPS_VIEW,
      href: '/tips',
      icon: DollarSign,
    },
    {
      name: 'Shifts',
      permission: Permission.SHIFTS_VIEW,
      href: '/shifts',
      icon: Clock,
    },
    {
      name: 'Employees',
      permission: Permission.EMPLOYEES_VIEW,
      href: '/employees',
      icon: Users,
    },
    {
      name: 'Payroll',
      permission: Permission.PAYROLL_VIEW,
      href: '/payroll',
      icon: Calculator,
    },
    {
      name: 'Error Detection',
      permission: Permission.SHIFTS_VIEW,
      href: '/error-detection',
      icon: BarChart3,
    },
  ].filter(item => !item.permission || (user && hasPermission(user.role as UserRole, item.permission)));

  const isActive = (href: string) => {
    return location.pathname === href || 
           (href === '/dashboard' && location.pathname === '/');
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U';
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex-shrink-0 flex items-center">
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">ShiftMint</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            {user && (
              <div className="hidden md:flex items-center space-x-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full p-0 hover:bg-gray-100"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-600 text-white text-sm">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSettings}>
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="text-gray-500 hover:text-gray-700"
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-base font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
              
              {user && (
                <div className="border-t pt-3 mt-3">
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-3 mb-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-600 text-white text-sm">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSettings}
                        className="w-full justify-start text-gray-500 hover:text-gray-700"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Settings
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLogout}
                        className="w-full justify-start text-gray-500 hover:text-gray-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Logout
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
