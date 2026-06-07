import React, { useState, useEffect } from "react";
import {
  Menu,
  X,
  ChevronRight,
  Sun,
  Moon,
  LandPlot,
  Columns,
  LayoutGrid,
  User,
  Building,
} from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import Breadcrumb from "../Breadcrumb/Breadcrumb";
import { roleRoutes, RouteItem } from "../../routes/routeConfig";
import { useLayout } from "../../contexts/LayoutContext";
// import { useTheme } from '../../contexts/ThemeContext';
import { useModalWithForm } from "../../contexts/ModelFormContext";
import { LocalStorageHelper } from "../../utils/localStorageHelper";
import { getRoleName } from "../../utils/data";
import "./VerticalLayout.css";

// Define menu items with icons and routes

interface MenuItemProps {
  item: RouteItem;
  level?: number;
}

const MenuItem: React.FC<MenuItemProps> = ({ item, level = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const hasChildren =
    item.subItems &&
    item.subItems.length > 0 &&
    !item.subItems.some(
      (subItem) => subItem.name === "" || subItem.name === "Create" || subItem.name === "Update",
    );

  const toggleSubmenu = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const menuItemClasses = (isActive: boolean) => `
  menu-item ${isActive ? "active" : ""} ${level > 0 ? "nested" : ""}
`;

  const shouldHighlight = (item: any) => {
    if (item.name === "" && item.element === Outlet) return false;
    return (
      location.pathname === item.href ||
      (hasChildren && item.href !== "" && location.pathname === "/" + item.href) ||
      (item.subItems?.some((subItem: any) => shouldHighlight(subItem)) ?? false)
    );
  };

  useEffect(() => {
    if (hasChildren && shouldHighlight(item)) {
      setIsOpen(true);
    }
  }, [hasChildren, item, location.pathname]);

  return (
    <div className='w-full'>
      {item.href && !hasChildren ? (
        <Link to={item.href} className={menuItemClasses(shouldHighlight(item))}>
          <span className='menu-item-content'>
            {item.icon && <span className='menu-item-icon'>{item.icon}</span>}
            {item.name}
          </span>
        </Link>
      ) : (
        <button onClick={toggleSubmenu} className={menuItemClasses(shouldHighlight(item))}>
          <span className='menu-item-content'>
            {item.icon && <span className='menu-item-icon'>{item.icon}</span>}
            {item.name}
          </span>
          {hasChildren && (
            <ChevronRight
              className={`menu-item-chevron ${isOpen ? "open" : ""}`}
              size={14}
            />
          )}
        </button>
      )}
      {hasChildren && isOpen && (
        <div className='submenu-container'>
          <div className='submenu-line' />
          <div className=''>
            {item?.subItems?.map(
              (child, index) =>
                child.name !== "" && (
                  <MenuItem key={`${child.name}-${index}`} item={child} level={level + 1} />
                ),
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const VerticalLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, currentOrg, logout, applicationRole, setApplicationRole } = useAuth();
  const { layout, setLayout } = useLayout();
  // const { theme, toggleTheme } = useTheme();
  const { handleOpenOrgModal } = useModalWithForm();
  const routesForRole = roleRoutes[applicationRole as string];

  // Toggle Layout mode
  const toggleLayoutMode = () => {
    const newLayout = layout === "VERTICAL" ? "HORIZONTAL" : "VERTICAL";
    setLayout(newLayout);
  };

  // Toggle sidebar for mobile
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar when route changes
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  return (
    <div className='flex h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300 fixed w-full'>
      {/* Mobile Overlay */}
      {isSidebarOpen && <div className='mobile-overlay' onClick={toggleSidebar} />}

      {/* Sidebar */}
      <div
        className={`sidebar-container ${isSidebarOpen ? "open" : ""}`}
      >
        {/* Header */}
        <div className='sidebar-header'>
          <h1 className='sidebar-title'>
            Ion<span>{applicationRole && getRoleName()[applicationRole].toUpperCase()}</span>
          </h1>
          <button onClick={toggleSidebar} className='sidebar-close-btn'>
            <X size={24} />
          </button>
        </div>

        {/* Navigation Menu - Make it scrollable */}
        <nav className='sidebar-nav'>
          {routesForRole &&
            Array.isArray(routesForRole) &&
            routesForRole
              .filter((item) => item.href !== "/change_password")
              .map((item, index) => <MenuItem key={`${item.name}-${index}`} item={item} />)}
        </nav>

        {/* User Profile and Logout - Fixed at bottom */}
        <div className='sidebar-footer'>
          <div className='user-profile'>
            <div className='user-info'>
              <div className='user-avatar'>
                <User className='w-5 h-5' />
              </div>
              <div className='user-details'>
                <p className='user-name'>
                  {authState?.username || "Guest"}
                </p>
                <Link
                  to='/change_password'
                  className='change-password-link'
                >
                  Change Password
                </Link>
              </div>
            </div>
            <button
              onClick={logout}
              className='logout-btn'
              title='Logout'
            >
              <svg
                className='w-5 h-5'
                xmlns='http://www.w3.org/2000/svg'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />
                <polyline points='16 17 21 12 16 7' />
                <line x1='21' y1='12' x2='9' y2='12' />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        {/* Top Navigation Bar */}
        <header className='panel-bg-1 dark:bg-gray-800 shadow-sm dark:shadow-gray-900 border-none'>
          <div className='flex items-center justify-between p-4'>
            {/* Mobile Menu Toggle */}
            <button onClick={toggleSidebar} className='lg:hidden text-color-1 dark:text-gray-300'>
              <Menu size={24} />
            </button>

            {/* Page Title or Breadcrumbs */}
            <h2 className='text-lg font-semibold text-color-1 dark:text-white capitalize'>
              {currentOrg?.label}
            </h2>

            {/* Dark Mode Toggle and Other Header Icons */}
            <div className='flex items-center space-x-4'>
              <button
                onClick={() => {
                  LocalStorageHelper.setObject("role", 'main');
                  setApplicationRole('main')
                  navigate("/");
                }}
                className='text-color-1 bg-gray-100 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-full'
              >
                <LandPlot className='h-4 w-4' aria-hidden='true' />
              </button>
              <button
                onClick={handleOpenOrgModal}
                className='text-color-1 bg-gray-100 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-full'
              >
                <Building className='h-4 w-4' />
              </button>
              <button
                onClick={toggleLayoutMode}
                className='text-color-1 bg-gray-100 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 p-2 rounded-full'
                title={`Switch to ${layout === "VERTICAL" ? "Horizontal" : "Vertical"} Layout`}
              >
                {layout === "VERTICAL" ? <Columns className='h-4 w-4' /> : <LayoutGrid className='h-4 w-4' />}
              </button>
              {/* <button
                onClick={toggleTheme}
                className="text-gray-600 dark:text-yellow-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full"
              >
                {theme === 'dark' ? <Moon className='h-4 w-4' /> : <Sun className='h-4 w-4' />}
              </button> */}
            </div>
          </div>
        </header>

        {/* Main Content Scrollable Area */}
        <main
          className='flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4'
          data-custom-scrollbar
        >
          <Breadcrumb location={location} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default VerticalLayout;
