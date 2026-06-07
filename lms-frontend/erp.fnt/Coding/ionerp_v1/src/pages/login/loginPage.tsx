import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import DynamicFormBuilder from "../../components/FormBuilder/DynamicFormBuilder";

import { loginFields, loginSchema } from "./loginSchema";
import { useAuth } from "../../hooks/useAuth";
import { loginPayload } from "./loginModel";
import { toast } from "react-toastify";
import { LocalStorageHelper } from "../../utils/localStorageHelper";
// import { getRoleName } from "../../utils/data";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loading, login } = useAuth();

  React.useEffect(() => {
    LocalStorageHelper.removeAll();
  }, []);

  const [showPassword, setShowPassword] = useState(false);
  // const [loginData, setLoginData] = useState<loginPayload>({
  //   role: "",
  //   username: "",
  //   password: "",
  // });

  const handleSubmit = useCallback(
    async (data: loginPayload) => {
      try {
        const res = await login("main", data.username, data.password);
        if (res) {
          navigate("/");
        } else {
          toast.error("Invalid credentials", {
            position: "top-right",
            autoClose: 3000,
          });
        }
      } catch (error) {
        toast.error("Login failed. Please try again.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    },
    [login, navigate],
  );

  // Modify fields to match expected type
  const modifiedLoginFields = loginFields.map((field) => ({
    group: "",
    fields: [
      {
        ...field,
        customProps:
          field.name === "password"
            ? {
              type: showPassword ? "text" : "password",
              rightIcon: showPassword ? (
                <Eye className='text-gray-400 cursor-pointer' onClick={() => setShowPassword(false)} />
              ) : (
                <EyeOff className='text-gray-400 cursor-pointer' onClick={() => setShowPassword(true)} />
              ),
            }
            : {},
      },
    ],
  }));

  return (
    <div className='min-h-screen relative flex items-center justify-center p-4 overflow-hidden' style={{
      background: 'radial-gradient(circle at top right, #1e1b4b, #0f172a 60%, #020617 100%)'
    }}>
      {/* Enhanced Layered Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[140px] animate-pulse" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[140px] animate-pulse" style={{ animationDelay: '3s' }} />
      <div className="absolute top-[20%] left-[10%] w-[200px] h-[200px] rounded-full bg-purple-500/5 blur-[80px]" />
      
      {/* Decorative Floating Circles */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5
          }}
          className="absolute rounded-full bg-white/5 border border-white/10"
          style={{
            width: 20 + (i * 15),
            height: 20 + (i * 15),
            left: `${20 + (i * 15)}%`,
            top: `${10 + (i * 20)}%`,
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: "circOut" }}
        className='relative z-10 w-full max-w-md'
      >
        <div className="backdrop-blur-2xl bg-white/[0.03] dark:bg-black/20 p-10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden">
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
          
          <div className='relative z-10 text-center mb-10'>
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 mb-6 shadow-2xl shadow-blue-600/40 border border-white/20"
            >
              <div className="text-white font-black text-3xl tracking-tighter drop-shadow-lg">ION</div>
            </motion.div>
            <h1 className='text-4xl font-extrabold text-white mb-3 tracking-tight'>
              Sign In
            </h1>
            <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full mb-4 opacity-50" />
            <p className='text-blue-100/50 text-sm font-medium'>Access the Education Management Portal</p>
          </div>
  
          <div className="login-form-container relative z-10">
            <style>
              {`
                .login-form-container label { 
                  color: rgba(255,255,255,0.45) !important; 
                  font-size: 0.75rem !important; 
                  text-transform: uppercase !important;
                  letter-spacing: 0.1em !important;
                  font-weight: 700 !important;
                  margin-bottom: 8px !important;
                  display: block !important;
                }
                .login-form-container input { 
                  background: rgba(255,255,255,0.03) !important; 
                  border: 1.5px solid rgba(255,255,255,0.08) !important; 
                  color: white !important;
                  border-radius: 16px !important;
                  padding: 14px 20px !important;
                  font-size: 1rem !important;
                  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .login-form-container input:focus { 
                  background: rgba(255,255,255,0.06) !important;
                  border-color: rgba(59,130,246,0.5) !important;
                  box-shadow: 0 0 25px rgba(59,130,246,0.15) !important;
                  transform: scale(1.01);
                }
                .login-form-container button { 
                  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%) !important;
                  border: none !important;
                  border-radius: 16px !important;
                  padding: 16px !important;
                  font-weight: 700 !important;
                  font-size: 1.1rem !important;
                  letter-spacing: 0.02em !important;
                  margin-top: 12px !important;
                  box-shadow: 0 10px 30px rgba(59,130,246,0.3) !important;
                  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
                  color: white !important;
                }
                .login-form-container button:hover {
                  transform: translateY(-2px);
                  box-shadow: 0 15px 40px rgba(59,130,246,0.4) !important;
                  filter: saturate(1.2) brightness(1.1);
                }
                .login-form-container button:active {
                  transform: translateY(0);
                }
              `}
            </style>
            <DynamicFormBuilder
              fields={modifiedLoginFields}
              schema={loginSchema}
              onSubmit={handleSubmit}
              loading={loading}
              submitbuttonName='Enter Portal'
              initialValues={{
                role: "main",
                username: "",
                password: "",
              }}
              columnLayout={1}
            />
          </div>
  
          <div className='relative z-10 text-center mt-8'>
            <a href='/forgot-password' border-b border-transparent className='text-blue-400/70 text-sm font-semibold hover:text-white transition-all duration-300'>
              Need help signing in?
            </a>
          </div>
        </div>
        
        <div className="mt-10 flex items-center justify-center space-x-2 text-blue-100/30 text-xs font-bold tracking-widest uppercase">
          <div className="w-8 h-[1px] bg-white/10" />
          <span>ION Education Platform</span>
          <div className="w-8 h-[1px] bg-white/10" />
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
