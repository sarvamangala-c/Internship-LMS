import React from "react";
import {
  IoSchool,
  IoBus,
  IoBook,
  IoArrowForward,
  IoSettingsSharp,
} from "react-icons/io5";
import { IconBaseProps } from "react-icons";
import { LocalStorageHelper } from "../utils/localStorageHelper";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { roleRoutes } from "../routes/routeConfig";

const MainPage: React.FC = () => {
  const navigator = useNavigate();

  const { isAuthenticated, setApplicationRole, applicationRole } = useAuth();

  React.useEffect(() => {
    if (!isAuthenticated) {
      navigator("/login");
    }
  }, [isAuthenticated, navigator]);

  // Map role keys to icons
  const iconMapping: { [key: string]: React.ComponentType<IconBaseProps> } = {
    ionems: IoBook,
    iontransport: IoBus,
    ionadmission: IoSchool,
    ionhostel: IoSchool,
  };

  // Get all available modules from roleRoutes
  const getAvailableModules = () => {
    return Object.keys(roleRoutes)
      .filter((role) => role !== "main") // Exclude main role from modules
      .map((role) => {
        const displayName = role
          .replace("ion", "")
          .split("")
          .map((c, i) => (i === 0 ? c.toUpperCase() : c))
          .join("");

        return {
          name: displayName || "Main",
          keyname: role,
          iconName: role,
          url: "/",
        };
      });
  };

  // Get configuration cards from current role's routes
  const getConfigurationCards = () => {
    const currentRoleRoutes = roleRoutes[applicationRole as keyof typeof roleRoutes] || [];
    const configCards: Array<{ name: string; url: string; title?: string }> = [];

    // Find the Configuration parent route and extract its subitems
    const configParent = currentRoleRoutes.find((route) => route.name === "Configurations" || route.name === "Configuration");

    if (configParent?.subItems) {
      configParent.subItems.forEach((subItem) => {
        // Only add items with names (filter out empty names which are usually for routing purposes)
        if (subItem.name && subItem.name.trim()) {
          configCards.push({
            name: subItem.name,
            title: subItem.name,
            url: subItem.href,
          });
        }
      });
    }

    return configCards;
  };

  const handleNavigate = React.useCallback(
    (keyname: string) => {
      LocalStorageHelper.setObject("role", keyname);
      setApplicationRole(keyname);
      navigator("/");
    },
    [navigator, setApplicationRole],
  );

  const modules = getAvailableModules();
  const configCards = getConfigurationCards();

  return (
    <div className="flex-grow">
      {/* Modules Section - Generated from roleRoutes */}
      <h1 className="text-color-1 text-lg font-semibold pb-3">Modules</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {modules.map((module, index) => {
          const IconComponent = iconMapping[module.iconName] || IoSchool;
          return (
            <div
              key={index}
              className="flex flex-col bg-white shadow-sm border border-slate-200 rounded-lg
                           p-4 hover:bg-gradient-to-br from-blue-50 to-red-50 hover:shadow-md
                           transition-all cursor-pointer"
              onClick={() => {
                handleNavigate(module.keyname);
              }}
            >
              <div className="flex items-center text-color-1 mb-4">
                <IconComponent className="h-6 w-6" />
                <h5 className="ml-3 text-xl font-semibold">{module.name}</h5>
              </div>
              <p className="text-slate-600 text-sm">
                Access {module.name} module
              </p>
              <div className="mt-auto pt-4">
                <span className="text-sm font-semibold main-page-text-color hover:text-red-500">
                  Go to {module.name} <IoArrowForward className="inline ml-1" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Section - Generated from current role's routes */}
      {configCards.length > 0 && (
        <>
          <h1 className="text-color-1 text-lg font-semibold mt-5 py-3">
            Configuration
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {configCards.map((card, index) => {
              return (
                <div
                  key={index}
                  className="flex flex-col bg-white shadow-sm border border-slate-200 rounded-lg
                             px-4 py-2 hover:bg-gradient-to-br from-blue-50 to-red-50 hover:shadow-md
                             transition-all cursor-pointer"
                  onClick={() => {
                    navigator(card.url);
                  }}
                >
                  <div className="mt-auto">
                    <span className="text-sm font-semibold main-page-text-color hover:text-red-500 flex justify-between items-center">
                      {card.title} <IoArrowForward className="inline ml-1" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default MainPage;
