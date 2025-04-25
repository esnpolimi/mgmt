import {HashRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import Login from './Pages/Login.jsx'
import ErasmusForm from './Pages/profiles/ErasmusForm.jsx';
import ESNerForm from './Pages/ESNerForm.jsx';
import ErasmusProfiles from './Pages/profiles/ErasmusProfiles.jsx';
import ESNersProfiles from './Pages/ESNersProfiles.jsx';
import Home from './Pages/Home.jsx'
import Treasury from './Pages/Treasury.jsx';
import EventsList from './Pages/events/EventsList.jsx';
import Event from './Pages/events/Event.jsx';
import {AuthProvider} from "./Context/AuthContext.jsx";
import ProtectedRoute from "./Components/ProtectedRoute.jsx";
import EmailVerification from './Pages/EmailVerification';


function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/verify-email/:uid/:token" element={<EmailVerification/>}/>
                    <Route path='/login' element={<Login/>}/>
                    <Route path='/' element={<ProtectedRoute><Home/></ProtectedRoute>}/>
                    <Route path='/erasmus_profiles' element={<ProtectedRoute><ErasmusProfiles/></ProtectedRoute>}/>
                    <Route path='/esners_profiles' element={<ProtectedRoute><ESNersProfiles/></ProtectedRoute>}/>
                    <Route path='/erasmus_form' element={<ErasmusForm/>}/>
                    <Route path='/esner_form' element={<ESNerForm/>}/>
                    <Route path='/treasury' element={<ProtectedRoute><Treasury/></ProtectedRoute>}/>
                    <Route path='/events' element={<ProtectedRoute><EventsList/></ProtectedRoute>}/>
                    <Route path='/event/:id' element={<ProtectedRoute><Event/></ProtectedRoute>}/>
                </Routes>
            </Router>
        </AuthProvider>
    )
}

export default App;
