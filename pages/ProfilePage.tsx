import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { useTranslation } from '../contexts/LanguageContext';
import { Profile, Movie } from '../types';
import { fetchFromTMDB } from '../services/apiService';
import { IMAGE_BASE_URL, POSTER_SIZE } from '../contexts/constants';

const AVATARS = [
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Default',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Happy',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Cool',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Wink',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Joy',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Star',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Heart',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Laughing',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Surprised',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Silly',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Calm',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Smart',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Excited',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Hero',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Zen',
    'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Creative',
];

const AvatarSelectionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (avatar: string) => void;
    currentAvatar: string;
}> = ({ isOpen, onClose, onSelect, currentAvatar }) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-2xl mx-auto my-auto bg-[var(--surface)] rounded-2xl p-4 sm:p-6 flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{t('chooseNewAvatar')}</h2>
                    <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </header>
                <main className="overflow-y-auto max-h-[60vh]">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                        {AVATARS.map(src => (
                            <img
                                key={src}
                                src={src}
                                alt="Avatar option"
                                onClick={() => onSelect(src)}
                                className={`w-full aspect-square object-cover rounded-full cursor-pointer transition-all duration-300 border-4 ${currentAvatar === src ? 'border-[var(--primary)] scale-105' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'}`}
                            />
                        ))}
                    </div>
                </main>
            </div>
        </div>
    );
};


const ProfileCreationStep1: React.FC<{
    onSave: (data: { name: string; avatar: string; type: 'ADULT' | 'KIDS' }) => void;
    onCancel: () => void;
    initialData?: Partial<Profile>;
    isEditing?: boolean;
}> = ({ onSave, onCancel, initialData = {}, isEditing = false }) => {
    const { t } = useTranslation();
    const [name, setName] = useState(initialData.name || '');
    const [avatar, setAvatar] = useState(initialData.avatar || AVATARS[0]);
    const [type, setType] = useState<'ADULT' | 'KIDS'>(initialData.type || 'ADULT');
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(name.trim()) onSave({ name, avatar, type });
    };

    const handleSelectAvatar = (newAvatar: string) => {
        setAvatar(newAvatar);
        setIsAvatarModalOpen(false);
    };

    return (
        <>
            <AvatarSelectionModal 
                isOpen={isAvatarModalOpen} 
                onClose={() => setIsAvatarModalOpen(false)}
                onSelect={handleSelectAvatar}
                currentAvatar={avatar}
            />
            <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 bg-black text-white animate-fade-in">
                <header className="w-full text-center max-w-md mx-auto">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{isEditing ? t('editProfile') : t('createAProfile')}</h1>
                    <p className="text-gray-400 mt-2">{isEditing ? t('updateYourProfileDetails') : t('personalizeYourExperience')}</p>
                </header>

                <main className="flex-grow flex flex-col items-center justify-center w-full max-w-xs sm:max-w-sm my-8">
                    <div className="relative mb-6">
                        <img src={avatar} alt="Selected Avatar" className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-white/10 shadow-lg"/>
                        <button 
                            onClick={() => setIsAvatarModalOpen(true)} 
                            className="absolute bottom-0 right-0 w-10 h-10 bg-[var(--primary)] rounded-full flex items-center justify-center text-white border-2 border-black transition-transform hover:scale-110"
                            aria-label={t('change')}
                        >
                            <i className="fa-solid fa-pencil"></i>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="w-full space-y-8">
                        <div className="w-full">
                           <label htmlFor="profileName" className="sr-only">{t('name')}</label>
                            <input 
                                id="profileName"
                                type="text" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('name')}
                                required
                                maxLength={20}
                                className="w-full px-4 py-3 text-white text-center text-xl bg-[var(--surface)] border-2 border-transparent rounded-lg focus:outline-none focus:border-[var(--primary)] focus:bg-transparent transition-all duration-300"
                            />
                        </div>
                        
                        <div>
                            <span className="block text-center text-gray-400 mb-3">{t('profileType')}</span>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button" 
                                    onClick={() => setType('ADULT')} 
                                    className={`py-3 rounded-lg font-bold transition-all duration-300 btn-press ${type === 'ADULT' ? 'bg-[var(--primary)] text-white shadow-lg shadow-purple-500/20' : 'bg-[var(--surface)] text-gray-300 hover:bg-gray-700'}`}
                                >
                                    {t('adult')}
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setType('KIDS')}
                                    className={`py-3 rounded-lg font-bold transition-all duration-300 btn-press ${type === 'KIDS' ? 'bg-[var(--primary)] text-white shadow-lg shadow-purple-500/20' : 'bg-[var(--surface)] text-gray-300 hover:bg-gray-700'}`}
                                >
                                    {t('kids')}
                                </button>
                            </div>
                        </div>
                    </form>
                </main>

                <footer className="w-full max-w-sm mx-auto pb-4">
                    <div className="flex flex-col items-center gap-4">
                        <button onClick={handleSubmit} disabled={!name.trim()} className="w-full py-3.5 text-black bg-white rounded-full font-bold transition-all text-lg disabled:opacity-50 disabled:cursor-not-allowed btn-press">{isEditing ? t('saveChanges') : t('next')}</button>
                        <button type="button" onClick={onCancel} className="w-full py-3.5 text-gray-400 hover:text-white rounded-full font-bold transition-colors">{t('cancel')}</button>
                    </div>
                </footer>
            </div>
        </>
    );
};

const TasteSelectionCard: React.FC<{ item: Movie, isSelected: boolean, onSelect: () => void, index: number }> = ({ item, isSelected, onSelect, index }) => {
    return (
        <div 
            onClick={onSelect} 
            className={`relative cursor-pointer group animate-grid-item transition-all duration-300 ${isSelected ? 'scale-95' : 'interactive-card-sm'}`}
            style={{ animationDelay: `${index * 30}ms` }}
        >
            <img src={`${IMAGE_BASE_URL}${POSTER_SIZE}${item.poster_path}`} alt={item.title} className={`object-cover w-full aspect-[2/3] rounded-lg transition-opacity duration-300 ${isSelected ? 'opacity-40' : ''}`} />
            <div className={`absolute inset-0 rounded-lg transition-all duration-300 ${isSelected ? 'bg-black/50 border-4 border-[var(--primary)]' : 'bg-black/20 opacity-0 group-hover:opacity-100'}`}></div>
            {isSelected && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-5xl opacity-90"><i className="fa-solid fa-check-circle"></i></div>}
        </div>
    );
}

const ProfileTasteStep2: React.FC<{
    onBack: () => void;
    onSubmit: (selectedIds: number[]) => void;
}> = ({ onBack, onSubmit }) => {
    const { t } = useTranslation();
    const [movies, setMovies] = useState<Movie[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const MIN_SELECTIONS = 3;

    useEffect(() => {
        const fetchTasteMovies = async () => {
            setLoading(true);
            try {
                const res = await fetchFromTMDB('/movie/popular', { page: 1 });
                const res2 = await fetchFromTMDB('/movie/popular', { page: 2 });
                setMovies([...(res.results || []), ...(res2.results || [])].filter(m => m.poster_path));
            } catch (error) {
                console.error("Failed to fetch movies for taste selection", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTasteMovies();
    }, []);

    const handleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }
    
    const handleFinish = () => {
        onSubmit(selectedIds);
    }
    
    const handleSkip = () => {
        onSubmit([]);
    }

    return (
        <div className="flex flex-col min-h-screen bg-black text-white animate-fade-in">
            <header className="flex items-center justify-between p-4 z-10">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
                    <i className="fas fa-arrow-left text-xl"></i>
                </button>
                <button onClick={handleSkip} className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">{t('skip')}</button>
            </header>

            <div className="text-center px-6">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{t('tellUsWhatYouLove')}</h1>
                <p className="mt-2 text-gray-400">{t('chooseAtLeast', {count: MIN_SELECTIONS})}</p>
            </div>
            
            <main className="flex-1 overflow-y-auto no-scrollbar py-6 px-4">
                {loading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                        {Array.from({ length: 18 }).map((_, i) => (
                            <div key={i} className="aspect-[2/3] bg-[var(--surface)] rounded-lg skeleton"></div>
                        ))}
                    </div>
                ) : (
                     <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                        {movies.slice(0, 30).map((movie, index) => (
                            <TasteSelectionCard key={movie.id} item={movie} isSelected={selectedIds.includes(movie.id)} onSelect={() => handleSelect(movie.id)} index={index} />
                        ))}
                    </div>
                )}
            </main>

            <footer className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent flex justify-center z-10">
                <button 
                    onClick={handleFinish} 
                    disabled={selectedIds.length < MIN_SELECTIONS} 
                    className="px-10 py-4 text-white bg-[var(--primary)] rounded-full font-bold transition-all text-lg shadow-lg shadow-purple-500/30 disabled:bg-gray-600 disabled:opacity-70 disabled:shadow-none disabled:cursor-not-allowed btn-press"
                >
                    {t('done')} ({selectedIds.length})
                </button>
            </footer>
        </div>
    );
};

const ProfileEditPage: React.FC<{
    profileToEdit: Profile;
    onSave: (name: string, avatar: string, type: 'ADULT' | 'KIDS') => void;
    onCancel: () => void;
    onDelete: () => void;
}> = ({ profileToEdit, onSave, onCancel, onDelete }) => {
    const { t } = useTranslation();
    return (
        <div className="bg-black min-h-screen">
             <ProfileCreationStep1
                onSave={({ name, avatar, type }) => onSave(name, avatar, type)}
                onCancel={onCancel}
                initialData={profileToEdit}
                isEditing={true}
            />
            <div className="text-center pb-8 -mt-12 relative z-10">
                <button onClick={onDelete} className="w-full max-w-sm py-3.5 font-bold text-red-500 bg-transparent rounded-full transition-colors hover:bg-red-500/10">
                    {t('deleteProfile')}
                </button>
            </div>
        </div>
    );
};


const ProfileSelection: React.FC<{
    onSelect: (id: string) => void;
    onAdd: () => void;
    onEdit: (id: string) => void;
}> = ({ onSelect, onAdd, onEdit }) => {
    const { accountData } = useProfile();
    const { t } = useTranslation();
    const [editMode, setEditMode] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-black text-center animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-12">{t('whoIsWatching')}</h1>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 max-w-5xl mx-auto">
                {accountData?.screens.map(profile => (
                    <div key={profile.id} onClick={() => editMode ? onEdit(profile.id) : onSelect(profile.id)} className="flex flex-col items-center cursor-pointer group">
                        <div className="relative">
                            <img src={profile.avatar} alt={profile.name} className="w-28 h-28 md:w-36 md:h-36 object-cover rounded-2xl transition-all duration-300 transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-2xl"></div>
                            {editMode && <div className="absolute inset-0 flex items-center justify-center text-3xl text-white bg-black/60 rounded-2xl border-4 border-white"><i className="fa-solid fa-pencil"></i></div>}
                        </div>
                        <span className="mt-3 text-lg font-medium text-gray-300 transition-colors group-hover:text-white">{profile.name}</span>
                    </div>
                ))}
                {(accountData?.screens?.length ?? 0) < 5 && !editMode && (
                     <div onClick={onAdd} className="flex flex-col items-center cursor-pointer group">
                        <div className="flex items-center justify-center w-28 h-28 md:w-36 md:h-36 text-5xl text-gray-600 bg-transparent border-4 border-gray-700 rounded-2xl transition-all group-hover:bg-gray-800 group-hover:text-gray-400 group-hover:scale-105">
                            <i className="fa-solid fa-plus"></i>
                        </div>
                        <span className="mt-3 text-lg font-medium text-gray-400 transition-colors group-hover:text-white">{t('addProfile')}</span>
                    </div>
                )}
            </div>
            <button onClick={() => setEditMode(!editMode)} className="px-8 py-2.5 mt-16 text-gray-300 uppercase tracking-widest bg-[var(--surface)] border border-transparent rounded-md transition-all duration-300 hover:border-gray-600 hover:text-white">
                {editMode ? t('done') : t('manageProfiles')}
            </button>
        </div>
    );
};


const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { accountData, selectProfile, activeProfile, addProfile, updateProfile, deleteProfile, clearAllData } = useProfile();
    const { t } = useTranslation();
    const [view, setView] = useState<'select' | 'form' | 'edit'>('select');
    const [step, setStep] = useState(1);
    const [profileData, setProfileData] = useState<{ name: string; avatar: string; type: 'ADULT' | 'KIDS' } | null>(null);
    const [profileToEdit, setProfileToEdit] = useState<Profile | null>(null);

    useEffect(() => {
        if (activeProfile) {
            navigate('/home', { replace: true });
        } else if (!accountData) {
            // Loading state
        } else if (accountData.screens.length === 0) {
            setView('form');
            setStep(1);
            setProfileToEdit(null);
        } else {
            setView('select');
        }
    }, [activeProfile, accountData, navigate]);

    const handleSelect = (profileId: string) => {
        selectProfile(profileId);
    };

    const handleAdd = () => {
        setProfileToEdit(null);
        setProfileData(null);
        setStep(1);
        setView('form');
    };

    const handleEdit = (profileId: string) => {
        const profile = accountData?.screens.find(p => p.id === profileId);
        if (profile) {
            setProfileToEdit(profile);
            setView('edit');
        }
    };
    
    const handleCancel = () => {
        if (accountData && accountData.screens.length > 0) {
            setView('select');
        } else {
            // If there are no profiles, can't cancel out of creation.
            // This case should ideally not be hit if logic is sound.
        }
    }

    const handleSaveEdit = (name: string, avatar: string, type: 'ADULT' | 'KIDS') => {
        if (profileToEdit) {
            updateProfile(profileToEdit.id, { name, avatar, type });
        }
        setView('select');
    };

    const handleDelete = () => {
        if (profileToEdit && (accountData?.screens.length ?? 0) > 1) {
            if (window.confirm(t('deleteProfileConfirm', { name: profileToEdit.name }))) {
                deleteProfile(profileToEdit.id);
                setView('select');
            }
        } else {
            alert(t('lastProfileError'));
        }
    }
    
    const handleStep1Save = (data: { name: string; avatar: string; type: 'ADULT' | 'KIDS' }) => {
        setProfileData(data);
        setStep(2);
    };

    const handleStep2Submit = (tastePreferences: number[]) => {
        if (profileData) {
            const finalProfileData = { ...profileData, tastePreferences };
            const newProfile = addProfile(finalProfileData);
            if (newProfile) {
                selectProfile(newProfile.id);
            } else {
                setView('select');
            }
        }
    };

    if (!accountData) {
        return <div className="flex items-center justify-center h-screen bg-black text-white text-xl">{t('loadingProfiles')}</div>;
    }

    if (view === 'select') {
        return <ProfileSelection onSelect={handleSelect} onAdd={handleAdd} onEdit={handleEdit} />;
    }
    
    if (view === 'edit' && profileToEdit) {
         return <ProfileEditPage
            profileToEdit={profileToEdit}
            onSave={handleSaveEdit}
            onCancel={() => setView('select')}
            onDelete={handleDelete}
        />
    }
    
    if (view === 'form') {
        switch (step) {
            case 1:
                return <ProfileCreationStep1 onSave={handleStep1Save} onCancel={handleCancel} />;
            case 2:
                return <ProfileTasteStep2 onSubmit={handleStep2Submit} onBack={() => setStep(1)} />;
            default:
                setView('select');
                return null;
        }
    }

    return null;
};

export default ProfilePage;