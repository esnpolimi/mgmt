import {BrowserRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import {AuthProvider} from "./Context/AuthContext.jsx";
import {SidebarProvider} from './Context/SidebarContext.jsx';
import Login from './Pages/Login.jsx'
import ErasmusForm from './Pages/ErasmusForm.jsx';
import ESNerForm from './Pages/ESNerForm.jsx';
import ErasmusProfiles from './Pages/profiles/ErasmusProfiles.jsx';
import ESNersProfiles from './Pages/profiles/ESNersProfiles.jsx';
import Home from './Pages/Home.jsx'
import TreasuryDashboard from './Pages/treasury/TreasuryDashboard.jsx';
import AccountsList from './Pages/treasury/AccountsList.jsx';
import EventsList from './Pages/events/EventsList.jsx';
import Event from './Pages/events/Event.jsx';
import EventFormLogin from './Pages/events/EventFormLogin.jsx';
import EventForm from './Pages/events/EventForm.jsx';
import EventFormResult from './Pages/events/EventFormResult.jsx';
import EventPayment from './Pages/events/EventPayment.jsx';
import ProtectedRoute from "./Components/ProtectedRoute.jsx";
import EmailVerification from './Pages/EmailVerification.jsx';
import ResetPassword from "./Pages/ResetPassword.jsx";
import TransactionsList from "./Pages/treasury/TransactionsList.jsx";
import ReimbursementRequestsList from "./Pages/treasury/ReimbursementRequestsList.jsx";
import Profile from "./Pages/profiles/Profile.jsx";
import UrlSanitizer from "./UrlSanitizer";

function App() {
    return (
        <AuthProvider>
            <SidebarProvider>
                <Router>
                    <UrlSanitizer />
                    <Routes>
                        <Route path="/verify-email/:uid/:token" element={<EmailVerification/>}/>
                        <Route path="/reset-password/:uid/:token" element={<ResetPassword/>}/>
                        <Route path='/login' element={<Login/>}/>
                        <Route path='/' element={<ProtectedRoute><Home/></ProtectedRoute>}/>
                        <Route path='/profiles/erasmus' element={<ProtectedRoute><ErasmusProfiles/></ProtectedRoute>}/>
                        <Route path='/profiles/esners' element={<ProtectedRoute><ESNersProfiles/></ProtectedRoute>}/>
                        <Route path='/profile/:id' element={<ProtectedRoute><Profile/></ProtectedRoute>}/>
                        <Route path='/erasmus_form' element={<ErasmusForm/>}/>
                        <Route path='/esner_form' element={<ESNerForm/>}/>
                        <Route path='/events' element={<ProtectedRoute><EventsList/></ProtectedRoute>}/>
                        <Route path='/event/:id' element={<ProtectedRoute><Event/></ProtectedRoute>}/>
                        <Route path='/event/:id/formlogin' element={<EventFormLogin/>}/>
                        <Route path='/event/:id/form' element={<EventForm/>}/>
                        <Route path='/event/:id/formresult' element={<EventFormResult/>}/>
                        <Route path='/event/:id/pay' element={<EventPayment/>}/>
                        <Route path='/treasury' element={<ProtectedRoute requiredPermission="change_account"><TreasuryDashboard/></ProtectedRoute>}/>
                        <Route path='/treasury/accounts_list' element={<ProtectedRoute requiredPermission="change_account"><AccountsList/></ProtectedRoute>}/>
                        <Route path='/treasury/transactions_list' element={<ProtectedRoute requiredPermission="change_account"><TransactionsList/></ProtectedRoute>}/>
                        <Route path='/treasury/transactions_list/:id' element={<ProtectedRoute requiredPermission="change_account"><TransactionsList/></ProtectedRoute>}/>
                        <Route path='/treasury/reimbursement_requests_list' element={<ProtectedRoute><ReimbursementRequestsList/></ProtectedRoute>}/>
                    </Routes>
                </Router>
            </SidebarProvider>
        </AuthProvider>
    )
}

export default App;
