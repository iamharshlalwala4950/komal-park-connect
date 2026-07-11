import React, { useState } from "react";
import { login } from "./authService";
import "./loginForm.css";

export default function LoginForm({ onLoginSuccess }) {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    // New State: Tracks whether the password text is visible or masked
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
        setError("");
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const { data, error } = await login(
                formData.email,
                formData.password,
            );

            if (error) {
                setError(error.message);
                return;
            }

            console.log("Login Success", data);

            const sessionPayload = {
                ...data,
                loginTimestamp: Date.now()
            };

            const AUTH_TOKEN_KEY = "sb-pniuqioremyuomrvntaw-auth-token";
            localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(sessionPayload));

            if (onLoginSuccess) {
                onLoginSuccess();
            }
            
        } catch (err) {
            setError("Something went wrong. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="container-fluid d-flex align-items-center justify-content-center"
            style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #0d6efd, #6ea8fe)",
            }}
        >
            <div className="row w-100 justify-content-center">
                <div className="col-md-5 col-lg-4">
                    <div className="card shadow-lg border-0 rounded-4">
                        <div className="card-body p-5">
                            <div className="text-center mb-4">
                                <h2 className="fw-bold text-primary">
                                    Komal Park Connect
                                </h2>
                                <p className="text-muted mb-0">Welcome Back</p>
                            </div>

                            <form onSubmit={handleLogin}>
                                {/* Email */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">
                                        Email ID
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text">
                                            <i className="fa-solid fa-envelope"></i>
                                        </span>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-control"
                                            placeholder="Enter Email ID"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Password with Show/Hide Toggle */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">
                                        Enter Password
                                    </label>
                                    <div className="input-group">
                                        <span className="input-group-text">
                                            <i className="fa-solid fa-lock"></i>
                                        </span>
                                        <input
                                            // Dynamically swap between password and text types
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            name="password"
                                            className="form-control"
                                            placeholder="Enter Password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            required
                                        />
                                        {/* Clickable toggle icon addon */}
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() =>
                                                setShowPassword(!showPassword)
                                            }
                                            style={{ zIndex: 10 }}
                                        >
                                            <i
                                                className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                                            ></i>
                                        </button>
                                    </div>
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="alert alert-danger py-2">
                                        {error}
                                    </div>
                                )}

                                {/* Login Button */}
                                <div className="d-grid LoginButtonSection">
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-lg"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <>
                                                <span
                                                    className="spinner-border spinner-border-sm me-2"
                                                    role="status"
                                                ></span>
                                                Logging in...
                                            </>
                                        ) : (
                                            "Login"
                                        )}
                                    </button>
                                </div>

                                {/* Forgot Password */}
                                <div className="text-center mt-3">
                                    <button
                                        type="button"
                                        className="btn btn-link text-decoration-none p-0"
                                    >
                                        Forgot Password?
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}