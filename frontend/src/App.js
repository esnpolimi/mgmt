import {HashRouter as Router, Routes, Route} from 'react-router-dom';
import './App.css';
import Login from './Pages/Login.js'
import ErasmusForm from './Pages/ErasmusForm.js';
import ESNerForm from './Pages/ESNerForm.js';
import ErasmusProfiles from './Pages/ErasmusProfiles.js';
import ESNersProfiles from './Pages/ESNersProfiles.js';
import Home from './Pages/Home.js'
import Treasury from './Pages/Treasury.js';
import Events from './Pages/Events.js';
import {AuthProvider} from "./Context/AuthContext";
import ProtectedRoute from "./Components/ProtectedRoute";


function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path='/login' element={<Login/>}/>
                    <Route path='/' element={<ProtectedRoute><Home/></ProtectedRoute>}/>
                    <Route path='/erasmus_profiles' element={<ProtectedRoute><ErasmusProfiles/></ProtectedRoute>}/>
                    <Route path='/esners_profiles' element={<ProtectedRoute><ESNersProfiles/></ProtectedRoute>}/>
                    <Route path='/erasmus_form' element={<ProtectedRoute><ErasmusForm/></ProtectedRoute>}/>
                    <Route path='/esner_form' element={<ProtectedRoute><ESNerForm/></ProtectedRoute>}/>
                    <Route path='/treasury' element={<ProtectedRoute><Treasury/></ProtectedRoute>}/>
                    <Route path='/events' element={<ProtectedRoute><Events/></ProtectedRoute>}/>
                </Routes>
            </Router>
        </AuthProvider>
    )
}

export default App;
