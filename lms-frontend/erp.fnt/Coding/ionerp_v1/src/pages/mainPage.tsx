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

  // Color mapping for modules
  const colorMapping: { [key: string]: { bg: string; text: string; iconBg: string; border: string } } = {
    ionems: { bg: "bg-indigo-50/50", text: "text-indigo-600", iconBg: "bg-indigo-100", border: "border-indigo-100" },
    ionadmission: { bg: "bg-purple-50/50", text: "text-purple-600", iconBg: "bg-purple-100", border: "border-purple-100" },
    iontransport: { bg: "bg-emerald-50/50", text: "text-emerald-600", iconBg: "bg-emerald-100", border: "border-emerald-100" },
    ionhostel: { bg: "bg-amber-50/50", text: "text-amber-600", iconBg: "bg-amber-100", border: "border-amber-100" },
    default: { bg: "bg-slate-50/50", text: "text-slate-600", iconBg: "bg-slate-100", border: "border-slate-100" }
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
    <div className="flex-grow space-y-8">
      {/* Modules Section */}
      <div>
        <div className="flex items-center space-x-2 mb-6">
          <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
          <h1 className="text-slate-800 text-xl font-black tracking-tight uppercase">Available Modules</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {modules.map((module, index) => {
            const IconComponent = iconMapping[module.iconName] || IoSchool;
            const theme = colorMapping[module.keyname] || colorMapping.default;
            return (
              <div
                key={index}
                className={`group flex flex-col ${theme.bg} border ${theme.border} rounded-2xl p-6 
                             hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-1
                             transition-all duration-300 cursor-pointer relative overflow-hidden`}
                onClick={() => {
                  handleNavigate(module.keyname);
                }}
              >
                {/* Decorative Background Icon */}
                <IconComponent className={`absolute -right-4 -bottom-4 h-24 w-24 ${theme.text} opacity-5 transform rotate-12 transition-transform group-hover:rotate-0`} />
                
                <div className="flex items-center mb-6 relative z-10">
                  <div className={`p-3 ${theme.iconBg} rounded-xl shadow-sm transition-transform group-hover:scale-110`}>
                    <IconComponent className={`h-6 w-6 ${theme.text}`} />
                  </div>
                  <h5 className="ml-4 text-xl font-black text-slate-800 tracking-tight">{module.name}</h5>
                </div>
                
                <p className="text-slate-500 text-sm mb-6 leading-relaxed relative z-10">
                  Manage all aspects of the {module.name} module with advanced tools and reporting.
                </p>
                
                <div className="mt-auto relative z-10">
                  <span className={`text-sm font-bold ${theme.text} flex items-center group-hover:translate-x-1 transition-transform`}>
                    Launch Module <IoArrowForward className="ml-2" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Section */}
      {configCards.length > 0 && (
        <div className="pt-4">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-1.5 h-6 bg-slate-400 rounded-full" />
            <h1 className="text-slate-800 text-xl font-black tracking-tight uppercase">Management & Config</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {configCards.map((card, index) => {
              return (
                <div
                  key={index}
                  className="group flex flex-col bg-white border border-slate-100 rounded-xl
                             px-5 py-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5
                             transition-all duration-300 cursor-pointer"
                  onClick={() => {
                    navigator(card.url);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] font-bold text-slate-600 group-hover:text-indigo-600 transition-colors uppercase tracking-wide">
                      {card.title}
                    </span>
                    <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-indigo-50 transition-colors">
                      <IoArrowForward className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
