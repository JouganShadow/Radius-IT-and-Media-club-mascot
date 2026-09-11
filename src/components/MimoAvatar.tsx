import React from 'react';
import { AvatarState, MimoIntent } from '../types';
import { StrobiAvatar, RadiusAvatar } from './StrobiAvatar';

interface MimoAvatarProps {
  state: AvatarState;
  inputVolume: number;
  outputVolume: number;
  latestIntent?: MimoIntent;
  sizeClassName?: string;
}

export const MimoAvatar: React.FC<MimoAvatarProps> = (props) => {
  return <RadiusAvatar {...props} />;
};

export { StrobiAvatar, RadiusAvatar };

